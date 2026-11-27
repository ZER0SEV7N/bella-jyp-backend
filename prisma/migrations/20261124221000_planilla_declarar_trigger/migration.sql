-- Migración: permitir la declaración terminal de la planilla (PLA-F3).
--
-- Contexto:
--  * `proteger_planilla_congelada()` bloqueaba cualquier UPDATE sobre una planilla
--    CONGELADO o DECLARADO. La declaración (CONGELADO -> DECLARADO) necesita una
--    transición controlada, sin permitir que se alteren los importes congelados.
--  * DECLARADO sigue siendo inmutable (D4: no se reabre).
--  * La declaración exige un usuario CONTADOR activo y la marca `declarado_en`.

BEGIN;

CREATE OR REPLACE FUNCTION proteger_planilla_congelada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE incidencia incidencias_mes; rol_actor text; rol_declarante text;
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'PLANILLA_BLOQUEADA: no se permite borrar el historial.' USING ERRCODE = '23514'; END IF;
    IF TG_OP = 'UPDATE' THEN
        --D4: DECLARADO es terminal; el cierre declarado no admite ninguna modificación posterior.
        IF upper(OLD.estado::text) = 'DECLARADO' THEN
            RAISE EXCEPTION 'PLANILLA_BLOQUEADA: el período % es inmutable.', OLD.periodo USING ERRCODE = '23514';
        END IF;
        --PLA-F3: desde CONGELADO solo se admite declarar y sin alterar los importes congelados.
        IF upper(OLD.estado::text) = 'CONGELADO' THEN
            IF upper(NEW.estado::text) <> 'DECLARADO'
                OR (to_jsonb(NEW) - ARRAY['estado','comentarios','declarado_por','declarado_en','version','updated_at'])
                   <> (to_jsonb(OLD) - ARRAY['estado','comentarios','declarado_por','declarado_en','version','updated_at'])
            THEN
                RAISE EXCEPTION 'PLANILLA_BLOQUEADA: solo se admite declarar la planilla congelada.', OLD.periodo USING ERRCODE = '23514';
            END IF;
        END IF;
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
    --PLA-F3: la declaración exige un contador activo y su marca temporal.
    IF upper(NEW.estado::text) = 'DECLARADO' THEN
        SELECT rol::text INTO rol_declarante FROM usuarios WHERE id = NEW.declarado_por AND activo AND deleted_at IS NULL;
        IF rol_declarante IS DISTINCT FROM 'CONTADOR' OR NEW.declarado_en IS NULL THEN
            RAISE EXCEPTION 'PLANILLA_BLOQUEADA: la declaración requiere un contador activo.' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;

COMMIT;
