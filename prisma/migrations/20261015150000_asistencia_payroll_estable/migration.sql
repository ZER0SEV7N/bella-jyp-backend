-- Migración incremental: no elimina marcaciones ni ejecuta la propuesta completa de vacaciones.
-- Debe aplicarse después de las migraciones que crearon las tablas actuales del proyecto.
BEGIN;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM asistencia_marcacion GROUP BY empleado_id, fecha_hora, tipo_marcacion HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Hay marcaciones duplicadas. Revise el informe de duplicados antes de crear la restricción única.';
    END IF;
END $$;

ALTER TYPE tipo_marcacion_enum ADD VALUE IF NOT EXISTS 'SALIDA_ALMUERZO';
ALTER TYPE tipo_marcacion_enum ADD VALUE IF NOT EXISTS 'ENTRADA_ALMUERZO';
ALTER TABLE asistencia_marcacion ADD COLUMN motivo varchar(1000), ADD COLUMN usuario_id uuid REFERENCES usuarios(id), ADD COLUMN importacion_id varchar(64);
CREATE UNIQUE INDEX uq_marcacion_instante_tipo ON asistencia_marcacion(empleado_id, fecha_hora, tipo_marcacion);

ALTER TABLE solicitud ADD COLUMN hora_inicio varchar(5), ADD COLUMN hora_fin varchar(5), ADD COLUMN efecto_asistencia varchar(25) NOT NULL DEFAULT 'PENDIENTE_DEFINIR';
ALTER TABLE solicitud ADD CONSTRAINT ck_solicitud_horas CHECK ((hora_inicio IS NULL AND hora_fin IS NULL) OR (hora_inicio ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND hora_fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND fecha_inicio = fecha_fin AND hora_inicio < hora_fin));
ALTER TABLE solicitud ADD CONSTRAINT ck_solicitud_efecto CHECK (efecto_asistencia IN ('PENDIENTE_DEFINIR','CON_GOCE','SIN_GOCE','SUBSIDIO'));

ALTER TABLE incidencias_mes
    ADD COLUMN dias_vinculo integer NOT NULL DEFAULT 0, ADD COLUMN dias_sin_goce integer NOT NULL DEFAULT 0,
    ADD COLUMN minutos_sin_goce integer NOT NULL DEFAULT 0, ADD COLUMN minutos_salida_anticipada integer NOT NULL DEFAULT 0,
    ADD COLUMN minutos_extras_25 integer NOT NULL DEFAULT 0, ADD COLUMN minutos_extras_35 integer NOT NULL DEFAULT 0,
    ADD COLUMN pendientes integer NOT NULL DEFAULT 0, ADD COLUMN completo boolean NOT NULL DEFAULT false,
    ADD COLUMN vigente boolean NOT NULL DEFAULT false, ADD COLUMN version integer NOT NULL DEFAULT 1,
    ADD COLUMN fuente_hash varchar(64), ADD COLUMN detalle jsonb, ADD COLUMN motivo_revision varchar(1000),
    ADD COLUMN aprobado_por uuid REFERENCES usuarios(id), ADD COLUMN aprobado_en timestamptz;
ALTER TABLE incidencias_mes ADD CONSTRAINT ck_incidencia_aprobada_verificada CHECK (estado::text <> 'APROBADO' OR (vigente AND completo AND pendientes = 0 AND fuente_hash IS NOT NULL AND aprobado_por IS NOT NULL)) NOT VALID;
-- Los resúmenes antiguos conservan su estado, pero quedan no vigentes hasta una revisión explícita.
-- La restricción se crea NOT VALID para no inventar aprobaciones en datos históricos existentes.

CREATE TABLE asistencia_decision (
    id uuid PRIMARY KEY, empleado_id uuid NOT NULL REFERENCES empleados(id), fecha date NOT NULL,
    tipo varchar(20) NOT NULL CHECK (tipo IN ('AUSENCIA','MARCACIONES','SOBRETIEMPO')), datos jsonb NOT NULL,
    motivo varchar(1000) NOT NULL CHECK (length(trim(motivo)) >= 5), usuario_id uuid NOT NULL REFERENCES usuarios(id),
    version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_decision_dia_tipo UNIQUE(empleado_id, fecha, tipo)
);
CREATE TABLE asistencia_jornada (
    id uuid PRIMARY KEY, empleado_id uuid NOT NULL REFERENCES empleados(id), desde date NOT NULL,
    jornada_id uuid NOT NULL REFERENCES jornada(id), horario jsonb NOT NULL,
    tolerancia_minutos integer NOT NULL CHECK (tolerancia_minutos BETWEEN 0 AND 60),
    politica_tolerancia varchar(15) NOT NULL DEFAULT 'COMPLETA' CHECK (politica_tolerancia IN ('COMPLETA','EXCESO')),
    minutos_semana integer NOT NULL, motivo varchar(1000) NOT NULL CHECK (length(trim(motivo)) >= 5),
    usuario_id uuid NOT NULL REFERENCES usuarios(id), created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_asistencia_jornada_desde UNIQUE(empleado_id, desde)
);
CREATE TABLE asistencia_calendario (
    id uuid PRIMARY KEY, fecha date NOT NULL UNIQUE, nombre varchar(150) NOT NULL, motivo varchar(1000) NOT NULL,
    activo boolean NOT NULL DEFAULT true, usuario_id uuid NOT NULL REFERENCES usuarios(id), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE historial_planillas ADD COLUMN version integer NOT NULL DEFAULT 1, ADD COLUMN incidencia_version integer,
    ADD COLUMN fuente_hash varchar(64), ADD COLUMN snapshot_calculo jsonb,
    ADD COLUMN validado_por uuid REFERENCES usuarios(id), ADD COLUMN validado_en timestamptz;

-- UUIDv7 para auditorías generadas dentro de PostgreSQL, sin depender de extensiones adicionales.
CREATE OR REPLACE FUNCTION asistencia_uuid_v7() RETURNS uuid LANGUAGE plpgsql VOLATILE AS $$
DECLARE azar text := replace(gen_random_uuid()::text, '-', ''); tiempo text;
BEGIN
    tiempo := lpad(to_hex(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint), 12, '0');
    RETURN (tiempo || '7' || substr(azar, 14, 3) || substr(azar, 17, 16))::uuid;
END $$;

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

CREATE OR REPLACE FUNCTION asistencia_invalidar(emp uuid, mes text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    PERFORM asistencia_exigir_periodo_editable(emp, mes);
    UPDATE incidencias_mes SET vigente = false, version = version + 1, actualizado_en = now() WHERE empleado_id = emp AND periodo = mes;
END $$;

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

-- Sustituye la función antigua que comparaba estados en minúsculas y omitía DELETE.
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
DROP TRIGGER IF EXISTS trg_proteger_planilla ON historial_planillas;
CREATE TRIGGER trg_proteger_planilla BEFORE INSERT OR UPDATE OR DELETE ON historial_planillas FOR EACH ROW EXECUTE FUNCTION proteger_planilla_congelada();

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

DO $$ DECLARE tabla text; BEGIN
    FOREACH tabla IN ARRAY ARRAY['asistencia_marcacion','asistencia_decision','asistencia_jornada','asistencia_calendario','solicitud'] LOOP
        EXECUTE format('CREATE TRIGGER trg_asistencia_fuentes BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION asistencia_proteger_fuentes()', tabla);
    END LOOP;
    FOREACH tabla IN ARRAY ARRAY['asistencia_marcacion','asistencia_decision','asistencia_jornada','asistencia_calendario','incidencias_mes','historial_planillas'] LOOP
        EXECUTE format('CREATE TRIGGER trg_asistencia_auditoria AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION asistencia_auditar()', tabla);
    END LOOP;
END $$;
CREATE TRIGGER trg_asistencia_resumen BEFORE INSERT OR UPDATE OR DELETE ON incidencias_mes FOR EACH ROW EXECUTE FUNCTION asistencia_proteger_resumen();

-- Las tasas anuales sobre saldo y el tope del seguro no se infieren de porcentajes antiguos.
ALTER TABLE comisiones_afp ADD COLUMN comision_flujo_mixta numeric(6,4), ADD COLUMN remuneracion_maxima_asegurable numeric(12,4);
ALTER TABLE historial_planillas ADD COLUMN descuento_sin_goce numeric(12,4) NOT NULL DEFAULT 0;
CREATE TABLE adelanto_desembolso (
    id uuid PRIMARY KEY, solicitud_id uuid NOT NULL UNIQUE REFERENCES solicitud(id), empleado_id uuid NOT NULL REFERENCES empleados(id),
    monto numeric(12,4) NOT NULL CHECK (monto > 0), fecha date NOT NULL, periodo_descuento varchar(7) NOT NULL CHECK (periodo_descuento ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    referencia varchar(200) NOT NULL, usuario_id uuid NOT NULL REFERENCES usuarios(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX adelanto_desembolso_empleado_id_periodo_descuento_idx ON adelanto_desembolso(empleado_id, periodo_descuento);
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
CREATE TRIGGER trg_payroll_desembolso BEFORE INSERT OR UPDATE OR DELETE ON adelanto_desembolso FOR EACH ROW EXECUTE FUNCTION payroll_proteger_desembolso();
CREATE TRIGGER trg_asistencia_auditoria AFTER INSERT ON adelanto_desembolso FOR EACH ROW EXECUTE FUNCTION asistencia_auditar();

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
CREATE TRIGGER trg_asistencia_vinculo BEFORE UPDATE ON empleados FOR EACH ROW EXECUTE FUNCTION asistencia_proteger_vinculo();

-- Un descanso médico anterior puede cambiar el acumulado anual que usa un mes posterior.
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
CREATE TRIGGER trg_asistencia_medico_anual BEFORE INSERT OR UPDATE ON solicitud FOR EACH ROW EXECUTE FUNCTION asistencia_invalidar_acumulado_medico();

ALTER TABLE historial_planillas ADD COLUMN bono_extraordinario numeric(12,4) NOT NULL DEFAULT 0,
    ADD COLUMN descuento_autorizado numeric(12,4) NOT NULL DEFAULT 0, ADD COLUMN descuento_dso numeric(12,4) NOT NULL DEFAULT 0;
CREATE TABLE novedad_planilla (
    id uuid PRIMARY KEY, empleado_id uuid NOT NULL REFERENCES empleados(id), periodo varchar(7) NOT NULL,
    tipo varchar(40) NOT NULL CHECK (tipo IN ('BONO_EXTRAORDINARIO_REMUNERATIVO','DESCUENTO_AUTORIZADO','DESCUENTO_DSO')),
    monto numeric(12,4) NOT NULL CHECK (monto >= 0), motivo varchar(1000) NOT NULL, referencia_evidencia varchar(255) NOT NULL,
    estado varchar(15) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','APROBADO','RECHAZADO','ANULADO')),
    registrado_por uuid NOT NULL REFERENCES usuarios(id), resuelto_por uuid REFERENCES usuarios(id), motivo_resolucion varchar(1000),
    version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX novedad_planilla_empleado_id_periodo_idx ON novedad_planilla(empleado_id, periodo);
CREATE UNIQUE INDEX uq_novedad_dso_aprobada ON novedad_planilla(empleado_id, periodo) WHERE tipo = 'DESCUENTO_DSO' AND estado = 'APROBADO';
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
CREATE TRIGGER trg_payroll_novedad BEFORE INSERT OR UPDATE OR DELETE ON novedad_planilla FOR EACH ROW EXECUTE FUNCTION payroll_proteger_novedad();
CREATE TRIGGER trg_asistencia_auditoria AFTER INSERT OR UPDATE ON novedad_planilla FOR EACH ROW EXECUTE FUNCTION asistencia_auditar();
CREATE TRIGGER trg_solicitud_auditoria_atomica AFTER INSERT OR UPDATE ON solicitud FOR EACH ROW EXECUTE FUNCTION asistencia_auditar();
ALTER TABLE historial_planillas ADD COLUMN base_essalud numeric(12,4) NOT NULL DEFAULT 0, ADD COLUMN base_previsional numeric(12,4) NOT NULL DEFAULT 0;

-- El arranque verifica esta marca; no se inicia con auditorías o protecciones a medio instalar.
CREATE OR REPLACE FUNCTION asistencia_version_migracion() RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '2026-10-15.1'::text $$;
COMMIT;
