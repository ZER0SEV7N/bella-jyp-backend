-- ================================================================================================
-- SISTEMA DE PLANILLAS JYP — INSTALACIÓN DE PROTECCIONES SQL
-- ================================================================================================
-- Requiere tablas y columnas del schema.prisma actual. Reinstala funciones/triggers sin recrear
-- tablas ni cargar personas. Comparte las secciones 13–16 de basededatos.sql; la verificación
-- inicial comprueba compatibilidad.

BEGIN;

-- ================================================================================================
-- 0. COMPROBACIÓN DEL ESQUEMA EXISTENTE
-- ================================================================================================
-- Solo lectura. Distingue el SQL antiguo (empleado, enums minúsculos) del esquema actual.
DO $$
DECLARE faltante record;
BEGIN
    SELECT esperado.tabla, esperado.columna INTO faltante
    FROM (VALUES
        ('empleados','fecha_inicio'), ('empleados','fecha_cese'), ('usuarios','rol'),
        ('solicitud','hora_inicio'), ('solicitud','efecto_asistencia'),
        ('asistencia_jornada','minutos_semana'), ('asistencia_decision','datos'), ('asistencia_calendario','activo'),
        ('incidencias_mes','fuente_hash'), ('incidencias_mes','version'), ('incidencias_mes','completo'),
        ('historial_planillas','snapshot_calculo'), ('historial_planillas','fuente_hash'),
        ('historial_planillas','base_essalud'), ('historial_planillas','base_previsional'),
        ('historial_planillas','bono_extraordinario'), ('historial_planillas','validado_por'),
        ('novedad_planilla','estado'), ('adelanto_desembolso','solicitud_id'),
        ('comisiones_afp','comision_flujo_mixta'), ('comisiones_afp','remuneracion_maxima_asegurable'),
        ('parametro_legal','vigente_desde'), ('audit_log','direccion_ip')) AS esperado(tabla,columna)
    WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema=current_schema()
        AND c.table_name=esperado.tabla AND c.column_name=esperado.columna) LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Esquema incompatible: falta %.%. No se modificó la base. Revise INSTALACION.md antes de migrar.', faltante.tabla, faltante.columna;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
        WHERE t.typname='estado_planilla_enum' AND e.enumlabel='CONGELADO') THEN
        RAISE EXCEPTION 'Los estados deben corresponder al schema.prisma actual (CONGELADO en mayúsculas).';
    END IF;
    IF EXISTS (SELECT 1 FROM asistencia_marcacion GROUP BY empleado_id,fecha_hora,tipo_marcacion HAVING count(*)>1) THEN
        RAISE EXCEPTION 'Hay marcaciones duplicadas; no se eliminarán automáticamente.';
    END IF;
END $$;

-- ================================================================================================
-- 13. FUNCIONES: VALIDACIÓN, CIERRE Y AUDITORÍA
-- ================================================================================================

-- ------------------------------------------------------------------------------------------------
-- 13.1. asistencia_uuid_v7 — Generación de identificadores de auditoría
-- ------------------------------------------------------------------------------------------------

-- Entrada: Sin argumentos.
-- Efecto: Devuelve un UUIDv7 generado con el reloj del servidor SQL y aleatoriedad.
CREATE OR REPLACE FUNCTION asistencia_uuid_v7() RETURNS uuid LANGUAGE plpgsql VOLATILE AS $$
DECLARE azar text := replace(gen_random_uuid()::text, '-', ''); tiempo text;
BEGIN
    tiempo := lpad(to_hex(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint), 12, '0');
    RETURN (tiempo || '7' || substr(azar, 14, 3) || substr(azar, 17, 16))::uuid;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.2. asistencia_exigir_periodo_editable — Verificación de período editable
-- ------------------------------------------------------------------------------------------------

-- Entrada: emp: ID del empleado; mes: período YYYY-MM.
-- Efecto: Bloquea por empleado y rechaza fuentes de una asistencia aprobada o planilla que no
-- esté abierta.
CREATE OR REPLACE FUNCTION asistencia_exigir_periodo_editable(emp uuid, mes text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('asistencia:' || emp::text, 0));
    IF EXISTS (SELECT 1 FROM historial_planillas WHERE empleado_id = emp AND periodo = mes AND upper(estado::text) <> 'ABIERTO') THEN
        RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: la planilla del período % no está abierta.', mes USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM incidencias_mes WHERE empleado_id = emp AND periodo = mes AND estado::text = 'APROBADO') THEN
        RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: reabra la incidencia aprobada del período %.', mes USING ERRCODE = '23514';
    END IF;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.3. asistencia_invalidar — Invalidación de un resumen abierto
-- ------------------------------------------------------------------------------------------------

-- Entrada: emp: ID del empleado; mes: período YYYY-MM.
-- Efecto: Exige período editable, marca vigente=false e incrementa la versión del resumen
-- existente.
CREATE OR REPLACE FUNCTION asistencia_invalidar(emp uuid, mes text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    PERFORM asistencia_exigir_periodo_editable(emp, mes);
    UPDATE incidencias_mes SET vigente = false, version = version + 1, actualizado_en = now() WHERE empleado_id = emp AND periodo = mes;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.4. asistencia_proteger_fuentes — Protección de las fuentes de asistencia
-- ------------------------------------------------------------------------------------------------

-- Entrada: NEW/OLD y operación que recibe el trigger.
-- Efecto: Controla marcas, decisiones, jornadas, calendario y solicitudes; rechaza cambios
-- prohibidos e invalida los resúmenes abiertos afectados.
CREATE OR REPLACE FUNCTION asistencia_proteger_fuentes() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE datos jsonb; anterior jsonb; emp uuid; mes text; desde text; fila record;
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: las fuentes no se borran físicamente.' USING ERRCODE = '23514'; END IF;
    datos := to_jsonb(NEW);
    IF TG_OP = 'UPDATE' THEN anterior := to_jsonb(OLD); END IF;
    emp := (datos->>'empleado_id')::uuid;
    IF TG_TABLE_NAME = 'asistencia_marcacion' THEN
        IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: registre una decisión para corregir la marca original.' USING ERRCODE = '23514'; END IF;
        IF NOT EXISTS (SELECT 1 FROM empleados WHERE id = emp AND deleted_at IS NULL AND fecha_inicio IS NOT NULL
            AND ((datos->>'fecha_hora')::timestamptz AT TIME ZONE 'America/Lima')::date >= fecha_inicio
            AND (fecha_cese IS NULL OR ((datos->>'fecha_hora')::timestamptz AT TIME ZONE 'America/Lima')::date <= fecha_cese)) THEN
            RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: la marca está fuera del vínculo laboral.' USING ERRCODE = '23514';
        END IF;
        mes := to_char((datos->>'fecha_hora')::timestamptz AT TIME ZONE 'America/Lima', 'YYYY-MM');
        PERFORM asistencia_invalidar(emp, mes);
    ELSIF TG_TABLE_NAME = 'asistencia_decision' THEN
        IF TG_OP = 'UPDATE' AND (NEW.empleado_id <> OLD.empleado_id OR NEW.fecha <> OLD.fecha OR NEW.tipo <> OLD.tipo) THEN
            RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: una decisión no puede trasladarse a otro día o colaborador.' USING ERRCODE = '23514';
        END IF;
        PERFORM asistencia_invalidar(emp, substr(datos->>'fecha', 1, 7));
    ELSIF TG_TABLE_NAME = 'solicitud' THEN
        IF datos->>'tipo' NOT IN ('VACACIONES','LICENCIA_MEDICA','PERMISO','JUSTIFICACION_ASISTENCIA') THEN RETURN NEW; END IF;
        IF TG_OP = 'UPDATE' AND (anterior - ARRAY['observacion','responsable_id','updated_at','fecha_limite','sustento_url','sustento_nombre']) = (datos - ARRAY['observacion','responsable_id','updated_at','fecha_limite','sustento_url','sustento_nombre']) THEN RETURN NEW; END IF;
        IF datos->>'fecha_inicio' IS NULL OR datos->>'fecha_fin' IS NULL THEN
            IF datos->>'estado' = 'APROBADA' THEN RAISE EXCEPTION 'La solicitud de asistencia aprobada requiere ambas fechas.' USING ERRCODE = '23514'; END IF;
            RETURN NEW;
        END IF;
        IF (datos->>'fecha_fin')::date - (datos->>'fecha_inicio')::date > 366 THEN RAISE EXCEPTION 'El intervalo excede el alcance de un año.' USING ERRCODE = '23514'; END IF;
        FOR fila IN SELECT DISTINCT to_char(d, 'YYYY-MM') AS periodo FROM generate_series((datos->>'fecha_inicio')::date, (datos->>'fecha_fin')::date, interval '1 day') d ORDER BY 1 LOOP
            PERFORM asistencia_invalidar(emp, fila.periodo);
        END LOOP;
        IF TG_OP = 'UPDATE' AND anterior->>'fecha_inicio' IS NOT NULL AND anterior->>'fecha_fin' IS NOT NULL THEN
            FOR fila IN SELECT DISTINCT to_char(d, 'YYYY-MM') AS periodo FROM generate_series((anterior->>'fecha_inicio')::date, (anterior->>'fecha_fin')::date, interval '1 day') d ORDER BY 1 LOOP
                PERFORM asistencia_invalidar((anterior->>'empleado_id')::uuid, fila.periodo);
            END LOOP;
        END IF;
    ELSIF TG_TABLE_NAME = 'asistencia_jornada' THEN
        IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'La asignación histórica se conserva; registre otra vigencia.' USING ERRCODE = '23514'; END IF;
        PERFORM pg_advisory_xact_lock(hashtextextended('asistencia:' || emp::text, 0));
        FOR fila IN SELECT periodo FROM incidencias_mes WHERE empleado_id = emp AND periodo >= substr(datos->>'desde', 1, 7)
            UNION SELECT periodo FROM historial_planillas WHERE empleado_id = emp AND periodo >= substr(datos->>'desde', 1, 7) ORDER BY periodo LOOP
            PERFORM asistencia_invalidar(emp, fila.periodo);
        END LOOP;
    ELSIF TG_TABLE_NAME = 'asistencia_calendario' THEN
        IF TG_OP = 'UPDATE' AND NEW.fecha <> OLD.fecha THEN RAISE EXCEPTION 'No se puede trasladar un descanso a otra fecha.' USING ERRCODE = '23514'; END IF;
        mes := substr(datos->>'fecha', 1, 7);
        FOR fila IN SELECT empleado_id FROM incidencias_mes WHERE periodo = mes UNION SELECT empleado_id FROM historial_planillas WHERE periodo = mes ORDER BY empleado_id LOOP
            PERFORM asistencia_invalidar(fila.empleado_id, mes);
        END LOOP;
    END IF;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.5. asistencia_proteger_resumen — Protección del resumen mensual
-- ------------------------------------------------------------------------------------------------

-- Entrada: Fila de incidencias_mes recibida por el trigger.
-- Efecto: Impide borrado físico y cambios indebidos sobre aprobados; admite la reapertura
-- explícita y motivada prevista.
CREATE OR REPLACE FUNCTION asistencia_proteger_resumen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'El resumen de asistencia no se elimina físicamente.' USING ERRCODE = '23514'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('asistencia:' || NEW.empleado_id::text, 0));
    IF EXISTS (SELECT 1 FROM historial_planillas WHERE empleado_id = NEW.empleado_id AND periodo = NEW.periodo AND upper(estado::text) <> 'ABIERTO') THEN
        RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: la planilla del resumen no está abierta.' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado::text = 'APROBADO' THEN
        IF NEW.estado::text <> 'PENDIENTE' OR NEW.vigente OR NEW.motivo_revision IS NULL OR length(trim(NEW.motivo_revision)) < 5 OR NEW.aprobado_por IS NOT NULL THEN
            RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: solo se admite una reapertura explícita y motivada.' USING ERRCODE = '23514';
        END IF;
        IF (to_jsonb(NEW) - ARRAY['estado','vigente','version','motivo_revision','aprobado_por','aprobado_en','actualizado_en']) <> (to_jsonb(OLD) - ARRAY['estado','vigente','version','motivo_revision','aprobado_por','aprobado_en','actualizado_en']) THEN
            RAISE EXCEPTION 'No se puede alterar el cálculo durante la reapertura.' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.6. proteger_planilla_congelada — Inmutabilidad y requisitos de cierre
-- ------------------------------------------------------------------------------------------------

-- Entrada: Fila de historial_planillas recibida por el trigger.
-- Efecto: Impide borrar el historial o alterar un cierre. Exige contador activo, instantánea y
-- asistencia aprobada coherente antes de congelar.
CREATE OR REPLACE FUNCTION proteger_planilla_congelada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE incidencia incidencias_mes; rol_actor text;
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'PLANILLA_BLOQUEADA: no se permite borrar el historial.' USING ERRCODE = '23514'; END IF;
    IF TG_OP = 'UPDATE' AND upper(OLD.estado::text) IN ('CONGELADO','DECLARADO') THEN
        RAISE EXCEPTION 'PLANILLA_BLOQUEADA: el período % es inmutable.', OLD.periodo USING ERRCODE = '23514';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('asistencia:' || NEW.empleado_id::text, 0));
    IF upper(NEW.estado::text) IN ('CONGELADO','DECLARADO') THEN
        SELECT * INTO incidencia FROM incidencias_mes WHERE empleado_id = NEW.empleado_id AND periodo = NEW.periodo;
        SELECT rol::text INTO rol_actor FROM usuarios WHERE id = NEW.validado_por AND activo AND deleted_at IS NULL;
        IF rol_actor <> 'CONTADOR' OR rol_actor IS NULL OR NEW.snapshot_calculo IS NULL OR NEW.fuente_hash IS NULL OR NEW.validado_en IS NULL THEN
            RAISE EXCEPTION 'PLANILLA_BLOQUEADA: falta validación del contador o instantánea del cálculo.' USING ERRCODE = '23514';
        END IF;
        IF incidencia.estado::text <> 'APROBADO' OR NOT incidencia.vigente OR NOT incidencia.completo OR incidencia.pendientes <> 0 OR NEW.incidencia_version IS DISTINCT FROM incidencia.version OR incidencia.id IS NULL THEN
            RAISE EXCEPTION 'PLANILLA_BLOQUEADA: la asistencia aprobada cambió o está incompleta.' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.7. asistencia_auditar — Auditoría en la misma transacción
-- ------------------------------------------------------------------------------------------------

-- Entrada: Fila afectada y contexto local app.usuario_id/app.ip.
-- Efecto: Inserta valores antes/después en audit_log. En planillas evita duplicar la instantánea
-- completa.
CREATE OR REPLACE FUNCTION asistencia_auditar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE antes jsonb; despues jsonb; actor uuid; ip inet;
BEGIN
    actor := nullif(current_setting('app.usuario_id', true), '')::uuid;
    ip := coalesce(nullif(current_setting('app.ip', true), ''), '127.0.0.1')::inet;
    IF TG_OP = 'UPDATE' THEN antes := to_jsonb(OLD); END IF;
    despues := to_jsonb(NEW);
    --La auditoría del historial conserva metadatos y montos, sin duplicar el documento de cálculo completo.
    IF TG_TABLE_NAME = 'historial_planillas' THEN antes := antes - 'snapshot_calculo'; despues := despues - 'snapshot_calculo'; END IF;
    INSERT INTO audit_log(id, usuario_id, accion, tabla_afectada, registro_id, valores_antes, valores_despues, direccion_ip)
        VALUES(asistencia_uuid_v7(), actor, CASE WHEN TG_OP = 'INSERT' THEN 'CREATE' ELSE TG_OP END, TG_TABLE_NAME, NEW.id, antes, despues, ip);
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.8. payroll_proteger_desembolso — Integridad de la entrega de un adelanto
-- ------------------------------------------------------------------------------------------------

-- Entrada: Fila de adelanto_desembolso recibida por el trigger.
-- Efecto: Admite el alta una sola vez y exige solicitud aprobada, mismo beneficiario y mismo
-- importe; protege períodos cerrados.
CREATE OR REPLACE FUNCTION payroll_proteger_desembolso() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pedido solicitud;
BEGIN
    IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'PLANILLA_BLOQUEADA: el desembolso conserva la entrega original.' USING ERRCODE = '23514'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('asistencia:' || NEW.empleado_id::text, 0));
    IF EXISTS (SELECT 1 FROM historial_planillas WHERE empleado_id = NEW.empleado_id AND periodo = NEW.periodo_descuento AND upper(estado::text) <> 'ABIERTO') THEN
        RAISE EXCEPTION 'PLANILLA_BLOQUEADA: no puede agregarse un desembolso a ese período.' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO pedido FROM solicitud WHERE id = NEW.solicitud_id;
    IF pedido.id IS NULL OR pedido.tipo::text <> 'ADELANTO_SUELDO' OR pedido.estado::text <> 'APROBADA' OR pedido.empleado_id <> NEW.empleado_id OR pedido.monto <> NEW.monto THEN
        RAISE EXCEPTION 'El desembolso debe corresponder al monto y colaborador de un adelanto aprobado.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.9. asistencia_proteger_vinculo — Control de cambios del vínculo
-- ------------------------------------------------------------------------------------------------

-- Entrada: Fila anterior y nueva de empleados.
-- Efecto: Comprueba cambios de fechas de ingreso/cese contra los resúmenes y planillas que
-- resultarían afectados.
CREATE OR REPLACE FUNCTION asistencia_proteger_vinculo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE inicio date; fila record;
BEGIN
    IF NEW.fecha_inicio IS NOT DISTINCT FROM OLD.fecha_inicio AND NEW.fecha_cese IS NOT DISTINCT FROM OLD.fecha_cese THEN RETURN NEW; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('asistencia:' || NEW.id::text, 0));
    IF NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio THEN inicio := least(NEW.fecha_inicio, OLD.fecha_inicio);
    ELSE inicio := least(NEW.fecha_cese, OLD.fecha_cese); END IF;
    FOR fila IN SELECT periodo FROM incidencias_mes WHERE empleado_id = NEW.id AND periodo >= coalesce(to_char(inicio, 'YYYY-MM'), '0000-01')
        UNION SELECT periodo FROM historial_planillas WHERE empleado_id = NEW.id AND periodo >= coalesce(to_char(inicio, 'YYYY-MM'), '0000-01') ORDER BY periodo LOOP
        PERFORM asistencia_invalidar(NEW.id, fila.periodo);
    END LOOP;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.10. asistencia_invalidar_acumulado_medico — Invalidación por cambio médico anual
-- ------------------------------------------------------------------------------------------------

-- Entrada: Solicitud médica y su intervalo de fechas.
-- Efecto: Revisa períodos posteriores del ejercicio porque el acumulado médico de meses previos
-- puede afectar su evaluación.
CREATE OR REPLACE FUNCTION asistencia_invalidar_acumulado_medico() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE fila record; primero text; ultimo text;
BEGIN
    IF TG_OP = 'INSERT' AND (NEW.tipo::text <> 'LICENCIA_MEDICA' OR NEW.fecha_inicio IS NULL) THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND NEW.tipo::text <> 'LICENCIA_MEDICA' AND OLD.tipo::text <> 'LICENCIA_MEDICA' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - ARRAY['observacion','responsable_id','updated_at','fecha_limite','sustento_url','sustento_nombre']) = (to_jsonb(OLD) - ARRAY['observacion','responsable_id','updated_at','fecha_limite','sustento_url','sustento_nombre']) THEN RETURN NEW; END IF;
    primero := to_char(NEW.fecha_inicio, 'YYYY-MM'); ultimo := to_char(coalesce(NEW.fecha_fin, NEW.fecha_inicio), 'YYYY') || '-12';
    IF TG_OP = 'UPDATE' THEN
        primero := least(primero, to_char(OLD.fecha_inicio, 'YYYY-MM'));
        ultimo := greatest(ultimo, to_char(coalesce(OLD.fecha_fin, OLD.fecha_inicio), 'YYYY') || '-12');
    END IF;
    FOR fila IN SELECT periodo FROM incidencias_mes WHERE empleado_id = NEW.empleado_id AND periodo BETWEEN primero AND ultimo
        UNION SELECT periodo FROM historial_planillas WHERE empleado_id = NEW.empleado_id AND periodo BETWEEN primero AND ultimo ORDER BY periodo LOOP
        PERFORM asistencia_invalidar(NEW.empleado_id, fila.periodo);
    END LOOP;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.11. payroll_proteger_novedad — Protección del concepto variable y su visado
-- ------------------------------------------------------------------------------------------------

-- Entrada: Fila de novedad_planilla recibida por el trigger.
-- Efecto: Conserva el concepto original, exige contador activo para resolver y bloquea cambios
-- incompatibles con el cierre.
CREATE OR REPLACE FUNCTION payroll_proteger_novedad() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'PLANILLA_BLOQUEADA: las novedades se conservan para auditoría.' USING ERRCODE = '23514'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('asistencia:' || NEW.empleado_id::text, 0));
    IF EXISTS (SELECT 1 FROM historial_planillas WHERE empleado_id = NEW.empleado_id AND periodo = NEW.periodo AND upper(estado::text) <> 'ABIERTO') THEN
        RAISE EXCEPTION 'PLANILLA_BLOQUEADA: no se puede cambiar una novedad de ese período.' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - ARRAY['estado','resuelto_por','motivo_resolucion','version','updated_at']) <> (to_jsonb(OLD) - ARRAY['estado','resuelto_por','motivo_resolucion','version','updated_at']) THEN
        RAISE EXCEPTION 'La novedad original se conserva; anule y registre una nueva si debe corregirla.' USING ERRCODE = '23514';
    END IF;
    IF NEW.estado <> 'PENDIENTE' AND (NEW.resuelto_por IS NULL OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id = NEW.resuelto_por AND rol::text = 'CONTADOR' AND activo AND deleted_at IS NULL)) THEN
        RAISE EXCEPTION 'La resolución de una novedad corresponde a un contador activo.' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado <> 'PENDIENTE' AND NOT (OLD.estado = 'APROBADO' AND NEW.estado = 'ANULADO') THEN
        RAISE EXCEPTION 'La novedad ya está resuelta.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.12. payroll_validar_parametro — Control de vigencias de parámetros
-- ------------------------------------------------------------------------------------------------

-- Entrada: Código, valor e intervalo del parámetro.
-- Efecto: Serializa por código y rechaza valores negativos, intervalos invertidos y
-- superposición con otra vigencia.
CREATE OR REPLACE FUNCTION payroll_validar_parametro() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('parametro:' || NEW.codigo, 0));
    IF NEW.valor < 0 OR NEW.vigente_hasta < NEW.vigente_desde THEN
        RAISE EXCEPTION 'Parámetro negativo o fechas invertidas.' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM parametro_legal p WHERE p.codigo = NEW.codigo AND p.id <> NEW.id
        AND p.vigente_desde <= coalesce(NEW.vigente_hasta, 'infinity'::date)
        AND coalesce(p.vigente_hasta, 'infinity'::date) >= NEW.vigente_desde) THEN
        RAISE EXCEPTION 'Las vigencias del parámetro % se superponen.', NEW.codigo USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.13. payroll_validar_comision — Control de tasas y vigencias AFP
-- ------------------------------------------------------------------------------------------------

-- Entrada: AFP, porcentajes, tope e intervalo de comisión.
-- Efecto: Serializa por AFP y rechaza tasas/rangos inválidos o intervalos que se superponen.
CREATE OR REPLACE FUNCTION payroll_validar_comision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('afp:' || NEW.afp_id::text, 0));
    IF NEW.periodo_final < NEW.periodo_inicio OR NEW.aporte_obligatorio NOT BETWEEN 0 AND 100
        OR NEW.prima_seguro NOT BETWEEN 0 AND 100 OR NEW.comision_sobre_ra NOT BETWEEN 0 AND 100
        OR NEW.comision_mixta NOT BETWEEN 0 AND 100 OR NEW.comision_flujo_mixta NOT BETWEEN 0 AND 100
        OR NEW.remuneracion_maxima_asegurable <= 0 THEN
        RAISE EXCEPTION 'Tasa, tope o vigencia AFP inválidos.' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM comisiones_afp c WHERE c.afp_id = NEW.afp_id AND c.id <> NEW.id
        AND c.periodo_inicio <= coalesce(NEW.periodo_final, 'infinity'::date)
        AND coalesce(c.periodo_final, 'infinity'::date) >= NEW.periodo_inicio) THEN
        RAISE EXCEPTION 'Las vigencias AFP se superponen.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

-- ================================================================================================
-- 14. TRIGGERS: TABLAS Y MOMENTOS DE EJECUCIÓN
-- ================================================================================================

-- Las funciones anteriores definen las reglas. Estos triggers indican qué escritura las activa.
-- DROP TRIGGER IF EXISTS permite reinstalar la vinculación sin duplicarla.

DROP TRIGGER IF EXISTS trg_proteger_planilla ON historial_planillas;

-- ------------------------------------------------------------------------------------------------
-- trg_proteger_planilla en historial_planillas
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before insert or update or delete por fila y llama a proteger_planilla_congelada.

CREATE TRIGGER trg_proteger_planilla BEFORE INSERT OR UPDATE OR DELETE ON historial_planillas FOR EACH ROW EXECUTE FUNCTION proteger_planilla_congelada();

-- ------------------------------------------------------------------------------------------------
-- Triggers compartidos de fuentes y auditoría
-- ------------------------------------------------------------------------------------------------

-- El primer bucle protege marcas, decisiones, jornadas, calendario y solicitudes antes de
-- escribir. El segundo audita marcas, decisiones, jornadas, calendario, resúmenes y planillas
-- después de insertar/actualizar. Cada trigger pertenece a su tabla aunque comparta nombre.

DO $$ DECLARE tabla text; BEGIN
    FOREACH tabla IN ARRAY ARRAY['asistencia_marcacion','asistencia_decision','asistencia_jornada','asistencia_calendario','solicitud'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_asistencia_fuentes ON %I', tabla);
        EXECUTE format('CREATE TRIGGER trg_asistencia_fuentes BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION asistencia_proteger_fuentes()', tabla);
    END LOOP;
    FOREACH tabla IN ARRAY ARRAY['asistencia_marcacion','asistencia_decision','asistencia_jornada','asistencia_calendario','incidencias_mes','historial_planillas'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_asistencia_auditoria ON %I', tabla);
        EXECUTE format('CREATE TRIGGER trg_asistencia_auditoria AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION asistencia_auditar()', tabla);
    END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_asistencia_resumen ON incidencias_mes;

-- ------------------------------------------------------------------------------------------------
-- trg_asistencia_resumen en incidencias_mes
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before insert or update or delete por fila y llama a asistencia_proteger_resumen.

CREATE TRIGGER trg_asistencia_resumen BEFORE INSERT OR UPDATE OR DELETE ON incidencias_mes FOR EACH ROW EXECUTE FUNCTION asistencia_proteger_resumen();

DROP TRIGGER IF EXISTS trg_payroll_desembolso ON adelanto_desembolso;

-- ------------------------------------------------------------------------------------------------
-- trg_payroll_desembolso en adelanto_desembolso
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before insert or update or delete por fila y llama a payroll_proteger_desembolso.

CREATE TRIGGER trg_payroll_desembolso BEFORE INSERT OR UPDATE OR DELETE ON adelanto_desembolso FOR EACH ROW EXECUTE FUNCTION payroll_proteger_desembolso();

DROP TRIGGER IF EXISTS trg_asistencia_auditoria ON adelanto_desembolso;

-- ------------------------------------------------------------------------------------------------
-- trg_asistencia_auditoria en adelanto_desembolso
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta after insert por fila y llama a asistencia_auditar.

CREATE TRIGGER trg_asistencia_auditoria AFTER INSERT ON adelanto_desembolso FOR EACH ROW EXECUTE FUNCTION asistencia_auditar();

DROP TRIGGER IF EXISTS trg_asistencia_vinculo ON empleados;

-- ------------------------------------------------------------------------------------------------
-- trg_asistencia_vinculo en empleados
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before update por fila y llama a asistencia_proteger_vinculo.

CREATE TRIGGER trg_asistencia_vinculo BEFORE UPDATE ON empleados FOR EACH ROW EXECUTE FUNCTION asistencia_proteger_vinculo();

DROP TRIGGER IF EXISTS trg_asistencia_medico_anual ON solicitud;

-- ------------------------------------------------------------------------------------------------
-- trg_asistencia_medico_anual en solicitud
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before insert or update por fila y llama a asistencia_invalidar_acumulado_medico.

CREATE TRIGGER trg_asistencia_medico_anual BEFORE INSERT OR UPDATE ON solicitud FOR EACH ROW EXECUTE FUNCTION asistencia_invalidar_acumulado_medico();

DROP TRIGGER IF EXISTS trg_payroll_novedad ON novedad_planilla;

-- ------------------------------------------------------------------------------------------------
-- trg_payroll_novedad en novedad_planilla
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before insert or update or delete por fila y llama a payroll_proteger_novedad.

CREATE TRIGGER trg_payroll_novedad BEFORE INSERT OR UPDATE OR DELETE ON novedad_planilla FOR EACH ROW EXECUTE FUNCTION payroll_proteger_novedad();

DROP TRIGGER IF EXISTS trg_asistencia_auditoria ON novedad_planilla;

-- ------------------------------------------------------------------------------------------------
-- trg_asistencia_auditoria en novedad_planilla
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta after insert or update por fila y llama a asistencia_auditar.

CREATE TRIGGER trg_asistencia_auditoria AFTER INSERT OR UPDATE ON novedad_planilla FOR EACH ROW EXECUTE FUNCTION asistencia_auditar();

DROP TRIGGER IF EXISTS trg_solicitud_auditoria_atomica ON solicitud;

-- ------------------------------------------------------------------------------------------------
-- trg_solicitud_auditoria_atomica en solicitud
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta after insert or update por fila y llama a asistencia_auditar.

CREATE TRIGGER trg_solicitud_auditoria_atomica AFTER INSERT OR UPDATE ON solicitud FOR EACH ROW EXECUTE FUNCTION asistencia_auditar();

DROP TRIGGER IF EXISTS trg_parametro_vigencia ON parametro_legal;

-- ------------------------------------------------------------------------------------------------
-- trg_parametro_vigencia en parametro_legal
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before insert or update por fila y llama a payroll_validar_parametro.

CREATE TRIGGER trg_parametro_vigencia BEFORE INSERT OR UPDATE ON parametro_legal FOR EACH ROW EXECUTE FUNCTION payroll_validar_parametro();

DROP TRIGGER IF EXISTS trg_comision_vigencia ON comisiones_afp;

-- ------------------------------------------------------------------------------------------------
-- trg_comision_vigencia en comisiones_afp
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before insert or update por fila y llama a payroll_validar_comision.

CREATE TRIGGER trg_comision_vigencia BEFORE INSERT OR UPDATE ON comisiones_afp FOR EACH ROW EXECUTE FUNCTION payroll_validar_comision();

-- ================================================================================================
-- 15. RESTRICCIONES ADICIONALES Y UNICIDAD CONDICIONAL
-- ================================================================================================

-- Estos CHECK expresan reglas que Prisma no representa en el schema. NOT VALID conserva la
-- instalación sobre históricos pendientes de revisar, pero sí exige cumplimiento a nuevas
-- escrituras. El índice parcial permite un solo descuento DSO aprobado por empleado/período.

-- ------------------------------------------------------------------------------------------------
-- 15.1. Reglas del resumen mensual, horario y solicitudes
-- ------------------------------------------------------------------------------------------------
DO $$ BEGIN
    -- ck_jornada_minutos_regulares: Cota del dato almacenado: de 1 a 2880 minutos semanales. El
    -- motor comprueba además la distribución y duración diaria del horario regular.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_jornada_minutos_regulares' AND conrelid = 'asistencia_jornada'::regclass) THEN
        ALTER TABLE asistencia_jornada ADD CONSTRAINT ck_jornada_minutos_regulares CHECK (minutos_semana BETWEEN 1 AND 2880) NOT VALID;
    END IF;
    -- ck_incidencia_aprobada_verificada: APROBADO exige resumen vigente y completo, cero pendientes,
    -- huella de fuentes y usuario aprobador.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_incidencia_aprobada_verificada' AND conrelid = 'incidencias_mes'::regclass) THEN
        ALTER TABLE incidencias_mes ADD CONSTRAINT ck_incidencia_aprobada_verificada CHECK (estado::text <> 'APROBADO' OR (vigente AND completo AND pendientes = 0 AND fuente_hash IS NOT NULL AND aprobado_por IS NOT NULL)) NOT VALID;
    END IF;
    -- ck_solicitud_horas: Permiso parcial: las horas se informan juntas, usan HH:mm, mantienen orden
    -- y corresponden a la misma fecha.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_solicitud_horas' AND conrelid = 'solicitud'::regclass) THEN
        ALTER TABLE solicitud ADD CONSTRAINT ck_solicitud_horas CHECK ((hora_inicio IS NULL AND hora_fin IS NULL) OR (hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_inicio ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND hora_fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND fecha_inicio = fecha_fin AND hora_inicio < hora_fin)) NOT VALID;
    END IF;
    -- ck_solicitud_efecto: Limita los efectos a PENDIENTE_DEFINIR, CON_GOCE, SIN_GOCE y SUBSIDIO; el
    -- caso de uso resuelve su compatibilidad con el trámite.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_solicitud_efecto' AND conrelid = 'solicitud'::regclass) THEN
        ALTER TABLE solicitud ADD CONSTRAINT ck_solicitud_efecto CHECK (efecto_asistencia IN ('PENDIENTE_DEFINIR','CON_GOCE','SIN_GOCE','SUBSIDIO')) NOT VALID;
    END IF;
END $$;

-- Prisma no representa estos CHECK; el generador los añade a la instalación completa.
-- ------------------------------------------------------------------------------------------------
-- 15.2. Reglas de decisiones, jornada, novedades y desembolsos
-- ------------------------------------------------------------------------------------------------
DO $restricciones$
DECLARE regla record;
BEGIN
    FOR regla IN SELECT * FROM (VALUES
        -- ck_decision_tipo: La decisión diaria corresponde a AUSENCIA, MARCACIONES o SOBRETIEMPO.
        ('asistencia_decision','ck_decision_tipo', $$tipo IN ('AUSENCIA','MARCACIONES','SOBRETIEMPO')$$),
        -- ck_decision_motivo: El motivo de una decisión conserva al menos cinco caracteres después de
        -- quitar espacios extremos.
        ('asistencia_decision','ck_decision_motivo', 'length(trim(motivo)) >= 5'),
        -- ck_jornada_tolerancia: La tolerancia configurada se mantiene entre cero y sesenta minutos.
        ('asistencia_jornada','ck_jornada_tolerancia', 'tolerancia_minutos BETWEEN 0 AND 60'),
        -- ck_jornada_politica: La política de descuento de tardanza debe ser COMPLETA o EXCESO.
        ('asistencia_jornada','ck_jornada_politica', $$politica_tolerancia IN ('COMPLETA','EXCESO')$$),
        -- ck_jornada_motivo: La asignación histórica requiere un motivo de al menos cinco caracteres
        -- útiles.
        ('asistencia_jornada','ck_jornada_motivo', 'length(trim(motivo)) >= 5'),
        -- ck_novedad_monto: Un concepto variable no puede registrar un importe negativo.
        ('novedad_planilla','ck_novedad_monto', 'monto >= 0'),
        -- ck_novedad_tipo: Se admiten los tres conceptos implementados: bono extraordinario
        -- remunerativo, descuento autorizado y descuento DSO.
        ('novedad_planilla','ck_novedad_tipo', $$tipo IN ('BONO_EXTRAORDINARIO_REMUNERATIVO','DESCUENTO_AUTORIZADO','DESCUENTO_DSO')$$),
        -- ck_novedad_estado: Los estados de visado son PENDIENTE, APROBADO, RECHAZADO y ANULADO.
        ('novedad_planilla','ck_novedad_estado', $$estado IN ('PENDIENTE','APROBADO','RECHAZADO','ANULADO')$$),
        -- ck_desembolso_positivo: La entrega efectiva de un adelanto debe tener un importe mayor que
        -- cero.
        ('adelanto_desembolso','ck_desembolso_positivo', 'monto > 0')
    ) AS reglas(tabla,nombre,expresion) LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=regla.nombre AND conrelid=to_regclass(regla.tabla)) THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%s) NOT VALID', regla.tabla, regla.nombre, regla.expresion);
        END IF;
    END LOOP;
END $restricciones$;

-- Un solo ajuste de descanso semanal obligatorio aprobado por colaborador y período.
-- ------------------------------------------------------------------------------------------------
-- 15.3. Una novedad DSO aprobada por empleado y período
-- ------------------------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_novedad_dso_aprobada ON novedad_planilla (empleado_id, periodo)
WHERE
    tipo = 'DESCUENTO_DSO'
    AND estado = 'APROBADO';

-- ================================================================================================
-- 16. VERSIÓN INSTALADA Y CONFIRMACIÓN
-- ================================================================================================

-- ------------------------------------------------------------------------------------------------
-- 16.1. asistencia_version_migracion — Marca de la instalación SQL
-- ------------------------------------------------------------------------------------------------

-- Entrada: Sin argumentos.
-- Efecto: Devuelve la revisión instalada. Se define al final; el arranque comprueba también que
-- los triggers críticos estén activos.
CREATE OR REPLACE FUNCTION asistencia_version_migracion() RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '2026-10-21.1'::text $$;

COMMIT;