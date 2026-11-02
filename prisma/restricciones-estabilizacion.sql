-- Las vigencias se controlan también para escrituras fuera de la API.
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

DROP TRIGGER IF EXISTS trg_parametro_vigencia ON parametro_legal;

CREATE TRIGGER trg_parametro_vigencia BEFORE INSERT OR UPDATE ON parametro_legal FOR EACH ROW EXECUTE FUNCTION payroll_validar_parametro();

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

DROP TRIGGER IF EXISTS trg_comision_vigencia ON comisiones_afp;

CREATE TRIGGER trg_comision_vigencia BEFORE INSERT OR UPDATE ON comisiones_afp FOR EACH ROW EXECUTE FUNCTION payroll_validar_comision();

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_jornada_minutos_regulares' AND conrelid = 'asistencia_jornada'::regclass) THEN
        ALTER TABLE asistencia_jornada ADD CONSTRAINT ck_jornada_minutos_regulares CHECK (minutos_semana BETWEEN 1 AND 2880) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_incidencia_aprobada_verificada' AND conrelid = 'incidencias_mes'::regclass) THEN
        ALTER TABLE incidencias_mes ADD CONSTRAINT ck_incidencia_aprobada_verificada CHECK (estado::text <> 'APROBADO' OR (vigente AND completo AND pendientes = 0 AND fuente_hash IS NOT NULL AND aprobado_por IS NOT NULL)) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_solicitud_horas' AND conrelid = 'solicitud'::regclass) THEN
        ALTER TABLE solicitud ADD CONSTRAINT ck_solicitud_horas CHECK ((hora_inicio IS NULL AND hora_fin IS NULL) OR (hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_inicio ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND hora_fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND fecha_inicio = fecha_fin AND hora_inicio < hora_fin)) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_solicitud_efecto' AND conrelid = 'solicitud'::regclass) THEN
        ALTER TABLE solicitud ADD CONSTRAINT ck_solicitud_efecto CHECK (efecto_asistencia IN ('PENDIENTE_DEFINIR','CON_GOCE','SIN_GOCE','SUBSIDIO')) NOT VALID;
    END IF;
END $$;

-- Prisma no representa estos CHECK; el generador los añade a la instalación completa.
DO $restricciones$
DECLARE regla record;
BEGIN
    FOR regla IN SELECT * FROM (VALUES
        ('asistencia_decision','ck_decision_tipo', $$tipo IN ('AUSENCIA','MARCACIONES','SOBRETIEMPO')$$),
        ('asistencia_decision','ck_decision_motivo', 'length(trim(motivo)) >= 5'),
        ('asistencia_jornada','ck_jornada_tolerancia', 'tolerancia_minutos BETWEEN 0 AND 60'),
        ('asistencia_jornada','ck_jornada_politica', $$politica_tolerancia IN ('COMPLETA','EXCESO')$$),
        ('asistencia_jornada','ck_jornada_motivo', 'length(trim(motivo)) >= 5'),
        ('novedad_planilla','ck_novedad_monto', 'monto >= 0'),
        ('novedad_planilla','ck_novedad_tipo', $$tipo IN ('BONO_EXTRAORDINARIO_REMUNERATIVO','DESCUENTO_AUTORIZADO','DESCUENTO_DSO')$$),
        ('novedad_planilla','ck_novedad_estado', $$estado IN ('PENDIENTE','APROBADO','RECHAZADO','ANULADO')$$),
        ('adelanto_desembolso','ck_desembolso_positivo', 'monto > 0')
    ) AS reglas(tabla,nombre,expresion) LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=regla.nombre AND conrelid=to_regclass(regla.tabla)) THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%s) NOT VALID', regla.tabla, regla.nombre, regla.expresion);
        END IF;
    END LOOP;
END $restricciones$;

-- Un solo ajuste de descanso semanal obligatorio aprobado por colaborador y período.
CREATE UNIQUE INDEX IF NOT EXISTS uq_novedad_dso_aprobada ON novedad_planilla (empleado_id, periodo)
WHERE
    tipo = 'DESCUENTO_DSO'
    AND estado = 'APROBADO';