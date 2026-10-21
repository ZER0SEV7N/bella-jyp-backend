-- Comprobación sin modificaciones: ejecutar sobre una copia de la base actual.
DO $$
DECLARE nombre text;
BEGIN
    FOREACH nombre IN ARRAY ARRAY['empleados','usuarios','solicitud','asistencia_marcacion','incidencias_mes','historial_planillas','parametro_legal','comisiones_afp'] LOOP
        IF to_regclass('public.' || nombre) IS NULL THEN
            RAISE EXCEPTION 'Falta la tabla %. Esta migración requiere la base actual de feature/soporterrhh, no basededatos.sql antiguo.', nombre;
        END IF;
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='estado_planilla_enum' AND e.enumlabel='CONGELADO') THEN
        RAISE EXCEPTION 'El enum de planilla no coincide con la versión actual. Revise la línea base antes de migrar.';
    END IF;
    IF EXISTS (SELECT 1 FROM asistencia_marcacion GROUP BY empleado_id,fecha_hora,tipo_marcacion HAVING count(*)>1) THEN
        RAISE EXCEPTION 'Existen marcas duplicadas; revise empleado_id, fecha_hora y tipo_marcacion. No se eliminó ningún registro.';
    END IF;
    IF to_regprocedure('asistencia_version_migracion()') IS NOT NULL THEN
        RAISE EXCEPTION 'La migración de asistencia ya está aplicada; no vuelva a ejecutar su SQL.';
    END IF;
END $$;
