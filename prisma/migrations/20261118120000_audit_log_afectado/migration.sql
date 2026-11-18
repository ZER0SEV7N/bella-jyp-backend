-- Agrega a audit_log la entidad de negocio afectada para consultar el historial de una persona,
-- un área, un cargo o una jornada sin conocer la tabla técnica. Las columnas son opcionales:
-- los registros existentes se completan con prisma/auditoria-rellenar-afectado.sql.
BEGIN;

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS afectado_tipo varchar(30);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS afectado_id uuid;

CREATE INDEX IF NOT EXISTS idx_audit_log_afectado ON audit_log (afectado_tipo, afectado_id);

COMMENT ON COLUMN audit_log.afectado_tipo IS 'Tipo de entidad de negocio afectada (empleado, area, cargo, jornada, empresa); permite ver el historial de una persona sin conocer la tabla técnica.';
COMMENT ON COLUMN audit_log.afectado_id IS 'ID de la entidad de negocio afectada; NULL para cambios de la empresa.';

-- El trigger de auditoría atómica llena la entidad afectada (empleado por empleado_id; empresa
-- para asistencia_calendario).
CREATE OR REPLACE FUNCTION asistencia_auditar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE antes jsonb; despues jsonb; actor uuid; ip inet; v_afectado_tipo text; v_afectado_id uuid;
BEGIN
    actor := nullif(current_setting('app.usuario_id', true), '')::uuid;
    ip := coalesce(nullif(current_setting('app.ip', true), ''), '127.0.0.1')::inet;
    IF TG_OP = 'UPDATE' THEN antes := to_jsonb(OLD); END IF;
    despues := to_jsonb(NEW);
    IF TG_TABLE_NAME = 'asistencia_calendario' THEN
        v_afectado_tipo := 'empresa';
    ELSE
        v_afectado_id := nullif(despues->>'empleado_id', '')::uuid;
        IF v_afectado_id IS NOT NULL THEN v_afectado_tipo := 'empleado'; END IF;
    END IF;
    --La auditoría del historial conserva metadatos y montos, sin duplicar el documento de cálculo completo.
    IF TG_TABLE_NAME = 'historial_planillas' THEN antes := antes - 'snapshot_calculo'; despues := despues - 'snapshot_calculo'; END IF;
    INSERT INTO audit_log(id, usuario_id, accion, tabla_afectada, registro_id, valores_antes, valores_despues, direccion_ip, afectado_tipo, afectado_id)
        VALUES(asistencia_uuid_v7(), actor, CASE WHEN TG_OP = 'INSERT' THEN 'CREATE' ELSE TG_OP END, TG_TABLE_NAME, NEW.id, antes, despues, ip, v_afectado_tipo, v_afectado_id);
    RETURN NEW;
END $$;

COMMIT;
