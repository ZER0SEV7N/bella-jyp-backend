-- ================================================================================================
-- DATOS DE PRUEBA DASHBOARD RRHH: 30 COLABORADORES FICTICIOS, OCTUBRE Y NOVIEMBRE 2026 (UTF-8)
-- ================================================================================================
-- Propósito:
--   Cargar datos ficticios para que cada bloque del dashboard de RRHH muestre información real:
--   dotación (altas y ceses de octubre y noviembre 2026), asistencia de la semana, cumpleaños,
--   contratos próximos a vencer, solicitudes en trámite y cierre de asistencia.
--
-- Requisitos:
--   - Haber instalado antes la demostración n8n de 10 personas (`node scripts/aplicar-sql.cjs demo-10`).
--     Este script reutiliza de ella la jornada DEMO 40 HORAS, las áreas y cargos DEMO, el tipo de
--     documento DNI y el usuario ADMIN que registra los cambios. Si falta alguno, se detiene.
--   - Para el cargo y el área de cada colaborador se reutilizan los catálogos existentes; no se crean.
--
-- Identificación de los datos (para la limpieza):
--   - Empleados: nro_documento 79000001..79000030 y correo dashboardNN@demo-dashboard.test.
--   - Limpieza: scripts/pruebas-demo/dashboard-rrhh-demo-limpiar.sql.
--
-- Qué crea:
--   - Empleados con sus cargos y áreas, asignados a la jornada DEMO 40 HORAS (lunes a viernes).
--   - Altas en noviembre (3) y octubre (2); ceses en noviembre (2) y octubre (1).
--   - Cumpleaños: 7 en noviembre (uno el 22) y el resto en otros meses.
--   - Contratos VIGENTE para los activos: 5 vencen entre el 23/11 y el 22/12 (2 críticos, <= 15 días).
--   - Marcaciones de octubre y del 1 al 21 de noviembre 2026, según el horario de cada jornada:
--     aproximadamente 78 % puntual, 12 % tardanza, 5 % falta (sin marcas) y 5 % sin salida.
--   - Solicitudes: 6 en trámite (PENDIENTE o EN_REVISION) y 2 aprobadas que justifican faltas.
--
-- Cierre de asistencia:
--   Los resúmenes mensuales (incidencias_mes) NO se insertan aquí. Genérelos desde la pantalla de
--   Cierre mensual ("Generar") para octubre y noviembre de 2026; el dashboard los lee después.
--
-- Idempotencia:
--   Puede ejecutarse varias veces sin duplicar nada. Las tablas con triggers de protección se
--   insertan con NOT EXISTS (no con ON CONFLICT) para que el trigger no se dispare sobre filas ya
--   cargadas.
--
-- Aplicación (requiere permiso para escribir en la base de demostración):
--   podman exec -i planillas_db psql -v ON_ERROR_STOP=1 -U postgres -d planillas_db \
--     < scripts/pruebas-demo/dashboard-rrhh-demo.sql
-- ================================================================================================

SET client_encoding = 'UTF8';

SET app.entorno_pruebas = 'SI';

BEGIN;

DO $$
BEGIN
    PERFORM set_config('app.entorno_pruebas', 'SI', true);

    IF current_setting('app.entorno_pruebas', true) IS DISTINCT FROM 'SI' THEN
        RAISE EXCEPTION 'Active app.entorno_pruebas=SI solo en una BD de demostración';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM jornada WHERE id = '019a0000-0005-7000-8000-000000000001')
        OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id = '019a0000-0002-7000-8000-000000000001')
        OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id = '019a0000-0002-7000-8000-000000000002')
        OR NOT EXISTS (SELECT 1 FROM tipo_documento WHERE tipo_documento = 'DNI')
        OR NOT EXISTS (SELECT 1 FROM area WHERE id = '019a0100-0000-7000-8000-000000000001')
        OR NOT EXISTS (SELECT 1 FROM cargo WHERE id = '019a0100-0000-7000-8000-000000000002')
        OR NOT EXISTS (SELECT 1 FROM area WHERE id = '019a0000-0003-7000-8000-000000000001')
        OR NOT EXISTS (SELECT 1 FROM area WHERE id = '019a0000-0003-7000-8000-000000000002')
        OR NOT EXISTS (SELECT 1 FROM area WHERE id = '019a0000-0003-7000-8000-000000000003')
        OR NOT EXISTS (SELECT 1 FROM cargo WHERE id = '019a0000-0004-7000-8000-000000000001')
        OR NOT EXISTS (SELECT 1 FROM cargo WHERE id = '019a0000-0004-7000-8000-000000000002')
        OR NOT EXISTS (SELECT 1 FROM cargo WHERE id = '019a0000-0004-7000-8000-000000000003')
    THEN
        RAISE EXCEPTION 'Ejecute primero la demostración n8n (node scripts/aplicar-sql.cjs demo-10) y los catálogos base.';
    END IF;

    -- El registro de cambios se atribuye al administrador ficticio de la demostración.
    PERFORM set_config('app.usuario_id', '019a0000-0002-7000-8000-000000000001', true);
    PERFORM set_config('app.ip', '127.0.0.1', true);
END $$;

-- ------------------------------------------------------------------------------------------------
-- 1. PERSONAS FICTICIAS. Una sola fuente de datos para todos los pasos siguientes.
--    Cargo y área se reparten por (n % 4): Analista, Operador 1, Operador 2 y Operador 3.
-- ------------------------------------------------------------------------------------------------

DROP TABLE IF EXISTS demo_dashboard_personas;

CREATE TEMP TABLE demo_dashboard_personas ON COMMIT DROP AS
SELECT
    v.n,
    ('019a0000-0010-7000-8000-' || lpad(v.n::text, 12, '0'))::uuid AS empleado_id,
    ('790000' || lpad(v.n::text, 2, '0'))::varchar(20) AS nro_documento,
    v.nombre,
    v.apellido,
    v.sexo::sexo_enum AS sexo,
    v.fecha_nacimiento,
    v.fecha_inicio,
    v.fecha_cese,
    CASE v.n % 4
        WHEN 0 THEN '019a0100-0000-7000-8000-000000000002'
        WHEN 1 THEN '019a0000-0004-7000-8000-000000000001'
        WHEN 2 THEN '019a0000-0004-7000-8000-000000000002'
        ELSE '019a0000-0004-7000-8000-000000000003'
    END::uuid AS cargo_id,
    CASE v.n % 4
        WHEN 0 THEN '019a0100-0000-7000-8000-000000000001'
        WHEN 1 THEN '019a0000-0003-7000-8000-000000000001'
        WHEN 2 THEN '019a0000-0003-7000-8000-000000000002'
        ELSE '019a0000-0003-7000-8000-000000000003'
    END::uuid AS area_id,
    CASE
        WHEN v.fecha_cese IS NOT NULL THEN v.fecha_cese
        WHEN v.n = 2 THEN DATE '2026-11-30'
        WHEN v.n = 5 THEN DATE '2026-12-05'
        WHEN v.n = 8 THEN DATE '2026-12-12'
        WHEN v.n = 12 THEN DATE '2026-12-18'
        WHEN v.n = 14 THEN DATE '2026-12-22'
        ELSE DATE '2027-12-31'
    END AS fecha_fin_contrato
FROM (VALUES
    (1,  'Rosa',      'Huaman Quispe',      'FEMENINO',  DATE '1990-11-22', DATE '2021-03-15', NULL),
    (2,  'Jorge',     'Mamani Condori',     'MASCULINO', DATE '1984-04-08', DATE '2019-07-01', NULL),
    (3,  'Lucia',     'Flores Ccama',       'FEMENINO',  DATE '1992-06-17', DATE '2022-01-10', DATE '2026-11-06'),
    (4,  'Miguel',    'Tito Apaza',         'MASCULINO', DATE '1988-11-03', DATE '2023-05-22', NULL),
    (5,  'Andrea',    'Ccori Villanueva',   'FEMENINO',  DATE '1995-02-27', DATE '2020-09-01', NULL),
    (6,  'Renzo',     'Pacheco Ticona',     'MASCULINO', DATE '1991-09-14', DATE '2024-02-12', NULL),
    (7,  'Carmen',    'Layme Cusi',         'FEMENINO',  DATE '1979-11-09', DATE '2018-11-05', NULL),
    (8,  'Edwin',     'Rojas Mendoza',      'MASCULINO', DATE '1986-08-21', DATE '2025-01-20', NULL),
    (9,  'Patricia',  'Huanca Soto',        'FEMENINO',  DATE '1989-03-30', DATE '2021-06-14', DATE '2026-10-16'),
    (10, 'Victor',    'Yupanqui Salas',     'MASCULINO', DATE '1993-11-14', DATE '2022-08-30', NULL),
    (11, 'Gabriela',  'Chura Reyes',        'FEMENINO',  DATE '1997-05-05', DATE '2019-10-07', NULL),
    (12, 'Daniel',    'Paucar Vargas',      'MASCULINO', DATE '1983-07-19', DATE '2023-03-06', NULL),
    (13, 'Sofia',     'Nina Cardenas',      'FEMENINO',  DATE '1996-11-18', DATE '2024-09-16', NULL),
    (14, 'Luis',      'Quispe Ramos',       'MASCULINO', DATE '1980-01-26', DATE '2020-04-27', NULL),
    (15, 'Milagros',  'Choque Ortiz',       'FEMENINO',  DATE '1994-10-02', DATE '2025-06-02', NULL),
    (16, 'Hector',    'Ccahuana Rivera',    'MASCULINO', DATE '1975-12-08', DATE '2017-12-11', DATE '2026-11-13'),
    (17, 'Yesenia',   'Vilca Gutierrez',    'FEMENINO',  DATE '1998-11-27', DATE '2023-11-20', NULL),
    (18, 'Ronald',    'Machaca Pinto',      'MASCULINO', DATE '1987-04-12', DATE '2021-12-01', NULL),
    (19, 'Karina',    'Taipe Morales',      'FEMENINO',  DATE '1990-06-06', DATE '2024-05-13', NULL),
    (20, 'Jhon',      'Ancco Lazo',         'MASCULINO', DATE '1992-08-25', DATE '2022-02-14', NULL),
    (21, 'Paola',     'Ticllacuri Herrera', 'FEMENINO',  DATE '1999-11-30', DATE '2025-08-18', NULL),
    (22, 'Alex',      'Condori Huayta',     'MASCULINO', DATE '1985-03-11', DATE '2019-01-21', NULL),
    (23, 'Nelly',     'Sullca Ponce',       'FEMENINO',  DATE '1988-12-24', DATE '2024-07-08', NULL),
    (24, 'Franco',    'Ramos Benavides',    'MASCULINO', DATE '1994-02-15', DATE '2023-08-28', NULL),
    (25, 'Ruth',      'Espinoza Coaquira',  'FEMENINO',  DATE '1991-07-07', DATE '2026-10-05', NULL),
    (26, 'Oscar',     'Laura Tapia',        'MASCULINO', DATE '1989-05-29', DATE '2026-10-19', NULL),
    (27, 'Diana',     'Mendoza Aguilar',    'FEMENINO',  DATE '1996-09-09', DATE '2026-11-02', NULL),
    (28, 'Cesar',     'Yucra Calsin',       'MASCULINO', DATE '1982-10-16', DATE '2026-11-09', NULL),
    (29, 'Veronica',  'Huillca Porras',     'FEMENINO',  DATE '1993-04-04', DATE '2026-11-12', NULL),
    (30, 'Martin',    'Quiroz Velasquez',   'MASCULINO', DATE '1981-06-23', DATE '2025-12-01', NULL)
) AS v(n, nombre, apellido, sexo, fecha_nacimiento, fecha_inicio, fecha_cese);

-- ------------------------------------------------------------------------------------------------
-- 2. EMPLEADOS. Se crean activos; los ceses se aplican al final, cuando las marcas ya existen,
--    porque el trigger de fuentes solo acepta marcas de colaboradores sin baja.
-- ------------------------------------------------------------------------------------------------

INSERT INTO empleados (id, cargo_id, area_id, documento_id, jornada_id, estado_laboral, nombre, apellido,
    nro_documento, email, telefono, sexo, fecha_nacimiento, direccion, referencia_direccion,
    ubigeo, distrito, provincia, departamento, fecha_inicio, afp_fecha_filiacion, activo)
SELECT
    p.empleado_id,
    p.cargo_id,
    p.area_id,
    (SELECT t.id FROM tipo_documento t WHERE t.tipo_documento = 'DNI' LIMIT 1),
    '019a0000-0005-7000-8000-000000000001',
    'ACTIVO',
    p.nombre,
    p.apellido,
    p.nro_documento,
    'dashboard' || lpad(p.n::text, 2, '0') || '@demo-dashboard.test',
    '9' || lpad((10000000 + p.n)::text, 8, '0'),
    p.sexo,
    p.fecha_nacimiento,
    'Jr. Prueba ' || p.n || ' 100',
    'Domicilio ficticio',
    '150101',
    'LIMA',
    'LIMA',
    'LIMA',
    p.fecha_inicio,
    NULL,
    true
FROM demo_dashboard_personas p
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------------------------
-- 3. ASIGNACIÓN DE JORNADA. Copia de la jornada vigente desde la fecha de ingreso.
-- ------------------------------------------------------------------------------------------------

INSERT INTO asistencia_jornada (id, empleado_id, desde, jornada_id, horario, tolerancia_minutos,
    politica_tolerancia, minutos_semana, motivo, usuario_id)
SELECT
    ('019a0000-0013-7000-8000-' || lpad(p.n::text, 12, '0'))::uuid,
    p.empleado_id,
    p.fecha_inicio,
    j.id,
    j.horario_semanal,
    j.tolerancia_minutos,
    'COMPLETA',
    2400,
    'Carga de demostración documentada',
    '019a0000-0002-7000-8000-000000000001'
FROM demo_dashboard_personas p
JOIN jornada j ON j.id = '019a0000-0005-7000-8000-000000000001'
WHERE NOT EXISTS (
    SELECT 1 FROM asistencia_jornada a
    WHERE a.empleado_id = p.empleado_id AND a.desde = p.fecha_inicio
);

-- ------------------------------------------------------------------------------------------------
-- 4. CONTRATOS. Activos con VIGENTE; los ceses quedan FINALIZADOS en su fecha de baja.
-- ------------------------------------------------------------------------------------------------

INSERT INTO contratos (id, empleado_id, estado, tipo_modalidad, fecha_inicio, fecha_fin, renovado, observacion)
SELECT
    ('019a0000-0011-7000-8000-' || lpad(p.n::text, 12, '0'))::uuid,
    p.empleado_id,
    (CASE WHEN p.fecha_cese IS NULL THEN 'VIGENTE' ELSE 'FINALIZADO' END)::estado_contrato_enum,
    'PLAZO_FIJO',
    p.fecha_inicio,
    p.fecha_fin_contrato,
    false,
    'Contrato de demostración'
FROM demo_dashboard_personas p
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------------------------
-- 5. PLAN DE ASISTENCIA. Un día laborable por colaborador desde octubre 2026 hasta el 21/11/2026,
--    dentro de su vínculo. La categoría sale de un hash de empleado+fecha (sin random()), así que
--    el resultado es repetible.
-- ------------------------------------------------------------------------------------------------

DROP TABLE IF EXISTS demo_dashboard_dias;

CREATE TEMP TABLE demo_dashboard_dias ON COMMIT DROP AS
WITH base AS (
    SELECT
        p.n,
        p.empleado_id,
        d::date AS fecha,
        CASE extract(isodow FROM d)::int
            WHEN 1 THEN 'LUNES'
            WHEN 2 THEN 'MARTES'
            WHEN 3 THEN 'MIERCOLES'
            WHEN 4 THEN 'JUEVES'
            WHEN 5 THEN 'VIERNES'
            WHEN 6 THEN 'SABADO'
            ELSE 'DOMINGO'
        END AS dia,
        j.horario_semanal,
        ((hashtextextended(p.empleado_id::text || '|' || d::date::text, 0) % 100) + 100) % 100 AS bucket,
        ((hashtextextended(p.empleado_id::text || '|' || d::date::text || '|m', 0) % 30) + 30) % 30 AS r30,
        ((hashtextextended(p.empleado_id::text || '|' || d::date::text || '|s', 0) % 11) + 11) % 11 AS r11
    FROM demo_dashboard_personas p
    JOIN jornada j ON j.id = '019a0000-0005-7000-8000-000000000001'
    CROSS JOIN generate_series(TIMESTAMP '2026-10-01', TIMESTAMP '2026-11-21', INTERVAL '1 day') AS d
    WHERE d::date BETWEEN GREATEST(p.fecha_inicio, DATE '2026-10-01')
                      AND LEAST(COALESCE(p.fecha_cese, DATE '2026-11-21'), DATE '2026-11-21')
),
laborables AS (
    SELECT b.*, x.elem
    FROM base b
    CROSS JOIN LATERAL jsonb_array_elements(b.horario_semanal) AS x(elem)
    WHERE x.elem->>'dia' = b.dia
      AND (x.elem->>'laborable')::boolean
),
categorias AS (
    SELECT
        l.*,
        CASE
            WHEN l.bucket < 5 THEN 'FALTA'
            WHEN l.bucket < 10 THEN 'INCOMPLETA'
            WHEN l.bucket < 22 THEN 'TARDANZA'
            ELSE 'PUNTUAL'
        END AS categoria
    FROM laborables l
)
SELECT
    c.n,
    c.empleado_id,
    c.fecha,
    c.categoria,
    (c.elem->>'entrada')::time AS entrada,
    (c.elem->>'inicio_descanso')::time AS inicio_descanso,
    (c.elem->>'fin_descanso')::time AS fin_descanso,
    (c.elem->>'salida')::time AS salida,
    CASE WHEN c.categoria = 'TARDANZA' THEN 6 + c.r30 ELSE (c.r30 % 15) - 10 END::int AS desfase_entrada,
    c.r11::int AS desfase_salida
FROM categorias c;

-- Marcas del día según la categoría. Faltas: ninguna. Incompletas: sin SALIDA.
DROP TABLE IF EXISTS demo_dashboard_marcas;

CREATE TEMP TABLE demo_dashboard_marcas ON COMMIT DROP AS
SELECT
    d.empleado_id,
    d.fecha,
    x.tipo,
    ((d.fecha + x.hora + make_interval(mins => x.minutos))::text || '-05')::timestamptz AS instante
FROM demo_dashboard_dias d
CROSS JOIN LATERAL (VALUES
    ('ENTRADA',          d.entrada,          d.desfase_entrada),
    ('SALIDA_ALMUERZO',  d.inicio_descanso,  0),
    ('ENTRADA_ALMUERZO', d.fin_descanso,     0),
    ('SALIDA',           d.salida,           d.desfase_salida)
) AS x(tipo, hora, minutos)
WHERE d.categoria <> 'FALTA'
  AND NOT (d.categoria = 'INCOMPLETA' AND x.tipo = 'SALIDA');

-- Marcaciones. El trigger de fuentes solo se dispara en las filas nuevas (NOT EXISTS).
INSERT INTO asistencia_marcacion (id, empleado_id, fecha_hora, tipo_marcacion, metodo, motivo, usuario_id, importacion_id)
SELECT
    md5('dashboard-demo|' || m.empleado_id::text || '|' || m.fecha::text || '|' || m.tipo)::uuid,
    m.empleado_id,
    m.instante,
    m.tipo::tipo_marcacion_enum,
    'MANUAL',
    NULL,
    '019a0000-0002-7000-8000-000000000001',
    NULL
FROM demo_dashboard_marcas m
WHERE NOT EXISTS (
    SELECT 1 FROM asistencia_marcacion a
    WHERE a.empleado_id = m.empleado_id
      AND a.fecha_hora = m.instante
      AND a.tipo_marcacion = m.tipo::tipo_marcacion_enum
);

-- ------------------------------------------------------------------------------------------------
-- 6. CESES. Mismo cambio que aplica el sistema al dar de baja un legajo: activo=false,
--    estado CESADO, fecha_cese y deleted_at. Se aplica después de las marcas del vínculo.
-- ------------------------------------------------------------------------------------------------

UPDATE empleados e
SET activo = false,
    estado_laboral = 'CESADO'::estado_empleado_enum,
    fecha_cese = p.fecha_cese,
    deleted_at = (p.fecha_cese::text || ' 18:00:00-05')::timestamptz,
    updated_at = now()
FROM demo_dashboard_personas p
WHERE e.id = p.empleado_id
  AND p.fecha_cese IS NOT NULL
  AND e.deleted_at IS NULL;

-- ------------------------------------------------------------------------------------------------
-- 7. SOLICITUDES EN TRÁMITE (6). Códigos SOL-2026-901..906.
-- ------------------------------------------------------------------------------------------------

INSERT INTO solicitud (id, codigo, empleado_id, tipo, estado, fecha_inicio, fecha_fin, hora_inicio, hora_fin,
    efecto_asistencia, dias_solicitados, monto, motivo, responsable_id, fecha_limite, origen)
SELECT
    ('019a0000-0012-7000-8000-' || lpad(v.numero::text, 12, '0'))::uuid,
    'SOL-2026-' || v.numero,
    p.empleado_id,
    v.tipo::"TipoSolicitud",
    v.estado::"EstadoSolicitud",
    v.fecha_inicio::date,
    v.fecha_fin::date,
    v.hora_inicio,
    v.hora_fin,
    v.efecto,
    v.dias::int,
    v.monto::numeric,
    v.motivo,
    v.responsable::uuid,
    v.fecha_limite::date,
    v.origen
FROM (VALUES
    ('901', 4,  'VACACIONES',               'PENDIENTE',   '2026-12-07', '2026-12-11', NULL,    NULL,    'PENDIENTE_DEFINIR', '5', NULL,     'Vacaciones de fin de año',                        NULL,                                  '2026-11-30', 'PORTAL_EMPLEADO'),
    ('902', 6,  'PERMISO',                  'PENDIENTE',   '2026-11-24', '2026-11-24', '15:00', '17:00', 'PENDIENTE_DEFINIR', '1', NULL,     'Cita médica particular',                          NULL,                                  '2026-11-23', 'PORTAL_EMPLEADO'),
    ('903', 11, 'LICENCIA_MEDICA',          'EN_REVISION', '2026-11-24', '2026-11-26', NULL,    NULL,    'PENDIENTE_DEFINIR', '3', NULL,     'Reposo médico con certificado adjunto',           '019a0000-0002-7000-8000-000000000002', NULL,         'PORTAL_EMPLEADO'),
    ('904', 18, 'ADELANTO_SUELDO',          'PENDIENTE',   NULL,         NULL,         NULL,    NULL,    'PENDIENTE_DEFINIR', NULL, '600.00', 'Adelanto por gastos del hogar',                   NULL,                                  '2026-12-01', 'PORTAL_EMPLEADO'),
    ('905', 22, 'JUSTIFICACION_ASISTENCIA', 'EN_REVISION', '2026-11-10', '2026-11-10', NULL,    NULL,    'PENDIENTE_DEFINIR', '1', NULL,     'Olvido de marcación de salida',                   '019a0000-0002-7000-8000-000000000002', NULL,         'PORTAL_EMPLEADO'),
    ('906', 24, 'ACTUALIZACION_DATOS',      'PENDIENTE',   NULL,         NULL,         NULL,    NULL,    'PENDIENTE_DEFINIR', NULL, NULL,    'Actualizar teléfono de contacto',                 NULL,                                  NULL,         'PORTAL_EMPLEADO')
) AS v(numero, persona, tipo, estado, fecha_inicio, fecha_fin, hora_inicio, hora_fin, efecto, dias, monto, motivo, responsable, fecha_limite, origen)
JOIN demo_dashboard_personas p ON p.n = v.persona
WHERE NOT EXISTS (
    SELECT 1 FROM solicitud s WHERE s.codigo = 'SOL-2026-' || v.numero
);

-- ------------------------------------------------------------------------------------------------
-- 8. FALTAS JUSTIFICADAS. Para cada uno de los dos primeros colaboradores (por documento) con
--    una falta en noviembre, se aprueba una solicitud sobre su primer día de falta.
-- ------------------------------------------------------------------------------------------------

DROP TABLE IF EXISTS demo_dashboard_faltas;

CREATE TEMP TABLE demo_dashboard_faltas ON COMMIT DROP AS
SELECT
    ROW_NUMBER() OVER (ORDER BY p.nro_documento) AS orden,
    f.empleado_id,
    f.fecha
FROM (
    SELECT DISTINCT ON (d.empleado_id) d.empleado_id, d.fecha
    FROM demo_dashboard_dias d
    WHERE d.categoria = 'FALTA' AND d.fecha >= DATE '2026-11-01'
    ORDER BY d.empleado_id, d.fecha
) f
JOIN demo_dashboard_personas p ON p.empleado_id = f.empleado_id;

INSERT INTO solicitud (id, codigo, empleado_id, tipo, estado, fecha_inicio, fecha_fin, efecto_asistencia,
    dias_solicitados, motivo, responsable_id, origen)
SELECT
    '019a0000-0012-7000-8000-000000000907'::uuid,
    'SOL-2026-907',
    f.empleado_id,
    'JUSTIFICACION_ASISTENCIA'::"TipoSolicitud",
    'APROBADA'::"EstadoSolicitud",
    f.fecha,
    f.fecha,
    'CON_GOCE',
    1,
    'Justificación aprobada por RRHH (demo)',
    '019a0000-0002-7000-8000-000000000002',
    'MANUAL_RRHH'
FROM demo_dashboard_faltas f
WHERE f.orden = 1
  AND NOT EXISTS (SELECT 1 FROM solicitud s WHERE s.codigo = 'SOL-2026-907');

INSERT INTO solicitud (id, codigo, empleado_id, tipo, estado, fecha_inicio, fecha_fin, efecto_asistencia,
    dias_solicitados, motivo, responsable_id, origen)
SELECT
    '019a0000-0012-7000-8000-000000000908'::uuid,
    'SOL-2026-908',
    f.empleado_id,
    'PERMISO'::"TipoSolicitud",
    'APROBADA'::"EstadoSolicitud",
    f.fecha,
    f.fecha,
    'CON_GOCE',
    1,
    'Permiso aprobado por RRHH (demo)',
    '019a0000-0002-7000-8000-000000000002',
    'MANUAL_RRHH'
FROM demo_dashboard_faltas f
WHERE f.orden = 2
  AND NOT EXISTS (SELECT 1 FROM solicitud s WHERE s.codigo = 'SOL-2026-908');

COMMIT;
