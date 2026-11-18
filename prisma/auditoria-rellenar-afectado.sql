-- Relleno de una sola vez de audit_log.afectado_tipo y audit_log.afectado_id para los registros
-- anteriores a la migración 20261118120000_audit_log_afectado. Es idempotente: solo toca filas
-- con afectado_tipo NULL, así que puede ejecutarse más de una vez. Ejecutar después de la migración.
BEGIN;

-- Empleado por su propio id. Las operaciones masivas (operacion_masiva) se omiten: su registro_id
-- es inventado y no identifica a nadie.
UPDATE audit_log SET afectado_tipo = 'empleado', afectado_id = registro_id
WHERE afectado_tipo IS NULL AND tabla_afectada = 'empleados'
  AND valores_despues ->> 'operacion_masiva' IS NULL;

-- Área, cargo y jornada por su propio id.
UPDATE audit_log SET afectado_tipo = 'area', afectado_id = registro_id
WHERE afectado_tipo IS NULL AND tabla_afectada = 'area'
  AND valores_despues ->> 'operacion_masiva' IS NULL;

UPDATE audit_log SET afectado_tipo = 'cargo', afectado_id = registro_id
WHERE afectado_tipo IS NULL AND tabla_afectada = 'cargo'
  AND valores_despues ->> 'operacion_masiva' IS NULL;

UPDATE audit_log SET afectado_tipo = 'jornada', afectado_id = registro_id
WHERE afectado_tipo IS NULL AND tabla_afectada = 'jornada'
  AND valores_despues ->> 'operacion_masiva' IS NULL;

-- Empleado por empleado_id: se toma de valores_despues y, en bajas físicas, de valores_antes.
UPDATE audit_log SET
    afectado_tipo = 'empleado',
    afectado_id = coalesce(valores_despues ->> 'empleado_id', valores_antes ->> 'empleado_id')::uuid
WHERE afectado_tipo IS NULL
  AND tabla_afectada IN ('contratos', 'derechohabientes', 'dato_financiero', 'solicitud',
                         'asistencia_marcacion', 'asistencia_jornada', 'asistencia_decision',
                         'incidencias_mes', 'historial_planillas', 'adelanto_desembolso',
                         'novedad_planilla')
  AND coalesce(valores_despues ->> 'empleado_id', valores_antes ->> 'empleado_id') IS NOT NULL;

-- Documentos de derechohabientes: el empleado sale del derechohabiente. Si el derechohabiente
-- ya no existe, el relleno queda en NULL.
UPDATE audit_log a SET afectado_tipo = 'empleado', afectado_id = d.empleado_id
FROM derechohabientes d
WHERE a.afectado_tipo IS NULL
  AND a.tabla_afectada = 'derechohabiente_documentos'
  AND d.id = coalesce(a.valores_despues ->> 'derechohabiente_id', a.valores_antes ->> 'derechohabiente_id')::uuid;

-- Jornada por área: el afectado es la jornada. Las operaciones masivas guardan las filas en datos
-- (objeto o arreglo) y el criterio en filtro; solo se rellena si la jornada es una sola.
UPDATE audit_log SET afectado_tipo = 'jornada', afectado_id = (valores_despues ->> 'jornada_id')::uuid
WHERE afectado_tipo IS NULL AND tabla_afectada = 'jornada_area'
  AND valores_despues ->> 'jornada_id' IS NOT NULL;

UPDATE audit_log SET afectado_tipo = 'jornada', afectado_id = (valores_antes ->> 'jornada_id')::uuid
WHERE afectado_tipo IS NULL AND tabla_afectada = 'jornada_area'
  AND valores_antes ->> 'jornada_id' IS NOT NULL;

UPDATE audit_log SET afectado_tipo = 'jornada', afectado_id = (valores_despues -> 'filtro' ->> 'jornada_id')::uuid
WHERE afectado_tipo IS NULL AND tabla_afectada = 'jornada_area'
  AND jsonb_typeof(valores_despues -> 'filtro') = 'object'
  AND valores_despues -> 'filtro' ->> 'jornada_id' IS NOT NULL;

UPDATE audit_log SET afectado_tipo = 'jornada', afectado_id = (valores_despues -> 'datos' ->> 'jornada_id')::uuid
WHERE afectado_tipo IS NULL AND tabla_afectada = 'jornada_area'
  AND jsonb_typeof(valores_despues -> 'datos') = 'object'
  AND valores_despues -> 'datos' ->> 'jornada_id' IS NOT NULL;

UPDATE audit_log a SET afectado_tipo = 'jornada', afectado_id = u.jornada_id
FROM (
    SELECT l.id, min(e ->> 'jornada_id')::uuid AS jornada_id
    FROM audit_log l
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(l.valores_despues -> 'datos') = 'array' THEN l.valores_despues -> 'datos' ELSE '[]'::jsonb END
    ) e
    WHERE l.afectado_tipo IS NULL AND l.tabla_afectada = 'jornada_area'
    GROUP BY l.id
    HAVING count(DISTINCT e ->> 'jornada_id') = 1 AND bool_and(e ->> 'jornada_id' IS NOT NULL)
) u
WHERE a.id = u.id;

-- Calendario laboral: pertenece a la empresa y no tiene id.
UPDATE audit_log SET afectado_tipo = 'empresa', afectado_id = NULL
WHERE afectado_tipo IS NULL AND tabla_afectada = 'asistencia_calendario';

COMMIT;
