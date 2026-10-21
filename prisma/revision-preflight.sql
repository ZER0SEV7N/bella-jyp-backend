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
