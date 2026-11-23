-- ================================================================================================
-- LIMPIEZA DE LOS DATOS DE PRUEBA DEL DASHBOARD RRHH (UTF-8)
-- ================================================================================================
-- Propósito:
--   Borrar solo lo que cargó scripts/pruebas-demo/dashboard-rrhh-demo.sql: los 30 colaboradores
--   ficticios, sus jornadas asignadas, marcaciones, contratos, solicitudes y resúmenes mensuales.
--
-- Identificación:
--   Empleados con nro_documento 79000001..79000040 y correo que termina en @demo-dashboard.test.
--   Todo lo demás (catálogos, áreas, cargos, jornadas, usuarios y la demostración n8n) se conserva.
--
-- Seguridad:
--   - Si alguno de estos colaboradores ya tiene registros reales (planillas, novedades,
--     desembolsos, decisiones de asistencia, usuarios, vacaciones, derechohabientes, datos
--     financieros o vínculos laborales), el script se detiene y no borra nada.
--   - Los triggers de protección de asistencia impiden borrar fuentes; por eso la transacción usa
--     session_replication_role = replica y vuelve a origin antes de confirmar.
--   - Requiere un usuario superusuario (postgres en la base de demostración).
--   - No borra audit_log: las filas de auditoría generadas por la carga se conservan como rastro.
--   - Al final verifica que no quede ninguna fila; si queda alguna, revierte todo.
--
-- Aplicación:
--   podman exec -i planillas_db psql -v ON_ERROR_STOP=1 -U postgres -d planillas_db \
--     < scripts/pruebas-demo/dashboard-rrhh-demo-limpiar.sql
-- ================================================================================================

SET client_encoding = 'UTF8';

BEGIN;

DO $$
BEGIN
    PERFORM set_config('app.entorno_pruebas', 'SI', true);

    IF current_setting('app.entorno_pruebas', true) IS DISTINCT FROM 'SI' THEN
        RAISE EXCEPTION 'Active app.entorno_pruebas=SI solo en una BD de demostración';
    END IF;
END $$;

DROP TABLE IF EXISTS demo_dashboard_limpieza;

CREATE TEMP TABLE demo_dashboard_limpieza ON COMMIT DROP AS
SELECT e.id
FROM empleados e
WHERE e.nro_documento BETWEEN '79000001' AND '79000040'
  AND e.email LIKE '%@demo-dashboard.test';

-- Protección: registros reales vinculados a la demostración detienen la limpieza.
DO $$
DECLARE
    v_vinculados bigint;
BEGIN
    SELECT
        (SELECT count(*) FROM dato_financiero WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza))
        + (SELECT count(*) FROM derechohabientes WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza))
        + (SELECT count(*) FROM asistencia_decision WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza))
        + (SELECT count(*) FROM historial_planillas WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza))
        + (SELECT count(*) FROM novedad_planilla WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza))
        + (SELECT count(*) FROM adelanto_desembolso WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza))
        + (SELECT count(*) FROM usuarios WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza))
        + (SELECT count(*) FROM vinculo_laboral WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza))
        + (SELECT count(*) FROM adelanto_desembolso WHERE solicitud_id IN (
              SELECT s.id FROM solicitud s WHERE s.empleado_id IN (SELECT id FROM demo_dashboard_limpieza)))
        + (SELECT count(*) FROM vacacion WHERE solicitud_id IN (
              SELECT s.id FROM solicitud s WHERE s.empleado_id IN (SELECT id FROM demo_dashboard_limpieza)))
    INTO v_vinculados;

    IF v_vinculados > 0 THEN
        RAISE EXCEPTION 'Hay % registros reales vinculados a los colaboradores de demostración; no se borró nada.', v_vinculados;
    END IF;
END $$;

-- Las fuentes de asistencia no se borran con los triggers activos; se desactivan solo en esta transacción.
SET session_replication_role = replica;

DELETE FROM asistencia_marcacion WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza);
DELETE FROM asistencia_jornada WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza);
DELETE FROM incidencias_mes WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza);
DELETE FROM solicitud WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza);
DELETE FROM contratos WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza);
DELETE FROM empleados WHERE id IN (SELECT id FROM demo_dashboard_limpieza);

SET session_replication_role = origin;

-- Verificación final: no debe quedar ninguna fila de la demostración.
DO $$
DECLARE
    v_restantes bigint;
BEGIN
    SELECT
        (SELECT count(*) FROM empleados WHERE id IN (SELECT id FROM demo_dashboard_limpieza))
        + (SELECT count(*) FROM asistencia_marcacion WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza))
        + (SELECT count(*) FROM asistencia_jornada WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza))
        + (SELECT count(*) FROM incidencias_mes WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza))
        + (SELECT count(*) FROM solicitud WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza))
        + (SELECT count(*) FROM contratos WHERE empleado_id IN (SELECT id FROM demo_dashboard_limpieza))
    INTO v_restantes;

    IF v_restantes > 0 THEN
        RAISE EXCEPTION 'La limpieza de la demostración no fue completa: quedan % filas.', v_restantes;
    END IF;
END $$;

COMMIT;
