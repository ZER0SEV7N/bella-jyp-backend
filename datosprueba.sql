-- Active: 1785200169721@@localhost@5432@planillas_db
-- =========================================================================
-- SCRIPT DE MOCK DATA - SISTEMA DE PLANILLAS JYP (ACTUALIZADO)
-- =========================================================================

-- 1. Limpieza de tablas (Cascada para evitar bloqueos por FKs)
TRUNCATE TABLE anotacion_tareas CASCADE;
TRUNCATE TABLE tareas_asistente CASCADE;
TRUNCATE TABLE tokens_seguridad CASCADE;
TRUNCATE TABLE audit_log CASCADE;
TRUNCATE TABLE usuarios CASCADE;
TRUNCATE TABLE asistencia_marcacion CASCADE;
TRUNCATE TABLE incidencias_mes CASCADE;
TRUNCATE TABLE historial_planillas CASCADE;
TRUNCATE TABLE dato_financiero CASCADE;
TRUNCATE TABLE contratos CASCADE;
TRUNCATE TABLE solicitud CASCADE;
TRUNCATE TABLE jornada_area CASCADE;
TRUNCATE TABLE empleado CASCADE;
TRUNCATE TABLE cargo CASCADE;
TRUNCATE TABLE jornada CASCADE;
TRUNCATE TABLE area CASCADE;
TRUNCATE TABLE tipo_afp CASCADE;
TRUNCATE TABLE comisiones_afp CASCADE;
TRUNCATE TABLE aportaciones CASCADE;
TRUNCATE TABLE regimen_pension CASCADE;
TRUNCATE TABLE bancos CASCADE;
TRUNCATE TABLE tipo_documento CASCADE;
TRUNCATE TABLE estado_empleado CASCADE;
TRUNCATE TABLE estado_contrato CASCADE;
TRUNCATE TABLE carga_masiva_jobs CASCADE;

-- 2. Catálogos Base (UUIDs deterministas)
INSERT INTO estado_empleado (id, descripcion) VALUES
('018f4a7c-1111-7000-a000-000000000001', 'ACTIVO'),
('018f4a7c-1111-7000-a000-000000000002', 'SUSPENDIDO'),
('018f4a7c-1111-7000-a000-000000000003', 'CESADO');

INSERT INTO tipo_documento (id, tipo_documento) VALUES
('018f4a7c-2222-7000-b000-000000000001', 'DNI'),
('018f4a7c-2222-7000-b000-000000000002', 'CE'),
('018f4a7c-2222-7000-b000-000000000003', 'PASAPORTE');

INSERT INTO bancos (id, nombre) VALUES
('018f4a7c-3333-7000-c000-000000000001', 'BCP'),
('018f4a7c-3333-7000-c000-000000000002', 'BBVA'),
('018f4a7c-3333-7000-c000-000000000003', 'INTERBANK'),
('018f4a7c-3333-7000-c000-000000000004', 'SCOTIABANK');

INSERT INTO regimen_pension (id, nombre) VALUES
('018f4a7c-4444-7000-d000-000000000001', 'ONP (Sistema Nacional)'),
('018f4a7c-4444-7000-d000-000000000002', 'AFP (Sistema Privado)');

INSERT INTO tipo_afp (id, id_regimen, nombre) VALUES
('018f4a7c-5555-7000-e000-000000000001', '018f4a7c-4444-7000-d000-000000000002', 'AFP INTEGRA'),
('018f4a7c-5555-7000-e000-000000000002', '018f4a7c-4444-7000-d000-000000000002', 'AFP PRIMA'),
('018f4a7c-5555-7000-e000-000000000003', '018f4a7c-4444-7000-d000-000000000002', 'AFP HABITAT'),
('018f4a7c-5555-7000-e000-000000000004', '018f4a7c-4444-7000-d000-000000000002', 'AFP PROFUTURO');

-- 3. Estructura Organizacional: Áreas
INSERT INTO area (id, nombre, descripcion, activo) VALUES
('018f4a7c-7777-7000-1111-000000000001', 'Oficina Central / Gerencia', 'Dirección General y TI', true),
('018f4a7c-7777-7000-1111-000000000002', 'Contabilidad y Finanzas', 'Gestión Financiera y Planillas', true),
('018f4a7c-7777-7000-1111-000000000003', 'Recursos Humanos', 'Gestión de Talento y Personal', true),
('018f4a7c-7777-7000-1111-000000000004', 'Seguridad y Operaciones', 'Personal Operativo y Vigilancia', true);

-- 4. Jornadas Laborales (Formato JSONB del Figma con created_at y updated_at explícitos)
INSERT INTO jornada (
  id, 
  nombre, 
  descripcion, 
  duracion, 
  turno, 
  modalidad, 
  tolerancia_minutos, 
  total_horas_semana, 
  horario_semanal, 
  activo,
  created_at,
  updated_at
) VALUES
-- Jornada 1: Oficina Estándar (Lun-Vie 08:00 a 17:00 con 1h de refrigerio = 40h)
(
  '018f4a7c-6666-7000-f000-000000000001',
  'Jornada Estándar Oficina',
  'Horario administrativo de 40h semanales de Lunes a Viernes',
  'TIEMPO_COMPLETO',
  'MANANA',
  'PRESENCIAL',
  15,
  40.00,
  '[
    {"dia": "LUNES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "08:00", "inicio_descanso": "13:00", "fin_descanso": "14:00", "salida": "17:00", "total_horas": 8},
    {"dia": "MARTES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "08:00", "inicio_descanso": "13:00", "fin_descanso": "14:00", "salida": "17:00", "total_horas": 8},
    {"dia": "MIERCOLES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "08:00", "inicio_descanso": "13:00", "fin_descanso": "14:00", "salida": "17:00", "total_horas": 8},
    {"dia": "JUEVES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "08:00", "inicio_descanso": "13:00", "fin_descanso": "14:00", "salida": "17:00", "total_horas": 8},
    {"dia": "VIERNES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "08:00", "inicio_descanso": "13:00", "fin_descanso": "14:00", "salida": "17:00", "total_horas": 8},
    {"dia": "SABADO", "laborable": false, "modalidad": "PRESENCIAL", "entrada": null, "inicio_descanso": null, "fin_descanso": null, "salida": null, "total_horas": 0},
    {"dia": "DOMINGO", "laborable": false, "modalidad": "PRESENCIAL", "entrada": null, "inicio_descanso": null, "fin_descanso": null, "salida": null, "total_horas": 0}
  ]'::jsonb,
  true,
  NOW(),
  NOW()
),
-- Jornada 2: Turno Noche Seguridad (Lun-Vie 22:00 a 06:00 del día siguiente = 40h)
(
  '018f4a7c-6666-7000-f000-000000000002',
  'Turno Nocturno Seguridad',
  'Turno de noche para vigilancia y control de acceso',
  'TIEMPO_COMPLETO',
  'NOCHE',
  'PRESENCIAL',
  10,
  40.00,
  '[
    {"dia": "LUNES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "22:00", "inicio_descanso": null, "fin_descanso": null, "salida": "06:00", "total_horas": 8},
    {"dia": "MARTES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "22:00", "inicio_descanso": null, "fin_descanso": null, "salida": "06:00", "total_horas": 8},
    {"dia": "MIERCOLES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "22:00", "inicio_descanso": null, "fin_descanso": null, "salida": "06:00", "total_horas": 8},
    {"dia": "JUEVES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "22:00", "inicio_descanso": null, "fin_descanso": null, "salida": "06:00", "total_horas": 8},
    {"dia": "VIERNES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "22:00", "inicio_descanso": null, "fin_descanso": null, "salida": "06:00", "total_horas": 8},
    {"dia": "SABADO", "laborable": false, "modalidad": "PRESENCIAL", "entrada": null, "inicio_descanso": null, "fin_descanso": null, "salida": null, "total_horas": 0},
    {"dia": "DOMINGO", "laborable": false, "modalidad": "PRESENCIAL", "entrada": null, "inicio_descanso": null, "fin_descanso": null, "salida": null, "total_horas": 0}
  ]'::jsonb,
  true,
  NOW(),
  NOW()
);

-- 5. Relación Jornada <-> Áreas Aplicables (Tabla pivote)
INSERT INTO jornada_area (jornada_id, area_id) VALUES
('018f4a7c-6666-7000-f000-000000000001', '018f4a7c-7777-7000-1111-000000000001'),
('018f4a7c-6666-7000-f000-000000000001', '018f4a7c-7777-7000-1111-000000000002'),
('018f4a7c-6666-7000-f000-000000000001', '018f4a7c-7777-7000-1111-000000000003'),
('018f4a7c-6666-7000-f000-000000000002', '018f4a7c-7777-7000-1111-000000000004');

-- 6. Cargos (Estructura limpia sin jornada_sugerida_id)
INSERT INTO cargo (id, id_area, nombre, descripcion, activo) VALUES
('018f4a7c-8888-7000-2222-000000000001', '018f4a7c-7777-7000-1111-000000000001', 'Administrador del Sistema', 'Gestión integral del sistema TI', true),
('018f4a7c-8888-7000-2222-000000000002', '018f4a7c-7777-7000-1111-000000000002', 'Contador Principal', 'Encargado de Planillas y Cierres', true),
('018f4a7c-8888-7000-2222-000000000003', '018f4a7c-7777-7000-1111-000000000003', 'Jefe de Recursos Humanos', 'Administración de personal y contratos', true),
('018f4a7c-8888-7000-2222-000000000004', '018f4a7c-7777-7000-1111-000000000003', 'Asistente de RRHH', 'Apoyo en tareas y marcaciones', true),
('018f4a7c-8888-7000-2222-000000000005', '018f4a7c-7777-7000-1111-000000000004', 'Vigilante Nocturno', 'Seguridad en sede principal', true),
('018f4a7c-8888-7000-2222-000000000006', '018f4a7c-7777-7000-1111-000000000001', 'Director Ejecutivo (JYP)', 'Socio Director General', true);

-- 7. Empleados Base (Con created_at y updated_at explícitos para evitar fallos de constraint)
INSERT INTO empleado (
  id, 
  cargo_id, 
  area_id, 
  documento_id, 
  estado_empleado_id, 
  jornada_id, 
  nombre, 
  apellido, 
  nro_documento, 
  email, 
  asig_familiar, 
  activo, 
  estado_sincronizacion,
  created_at,
  updated_at
) VALUES
-- 1. Empleado para ADMIN
(
  '018f4a7c-9999-7000-3333-000000000001',
  '018f4a7c-8888-7000-2222-000000000001',
  '018f4a7c-7777-7000-1111-000000000001',
  '018f4a7c-2222-7000-b000-000000000001',
  '018f4a7c-1111-7000-a000-000000000001',
  '018f4a7c-6666-7000-f000-000000000001',
  'Administrador', 'Sistema Central', '70000001', 'admin@jyp.com', false, true, 'COMPLETO',
  NOW(), NOW()
),
-- 2. Empleado para CONTADOR
(
  '018f4a7c-9999-7000-3333-000000000002',
  '018f4a7c-8888-7000-2222-000000000002',
  '018f4a7c-7777-7000-1111-000000000002',
  '018f4a7c-2222-7000-b000-000000000001',
  '018f4a7c-1111-7000-a000-000000000001',
  '018f4a7c-6666-7000-f000-000000000001',
  'Carlos', 'Ramírez Silva', '70112233', 'contador@jyp.com', false, true, 'COMPLETO',
  NOW(), NOW()
),
-- 3. Empleado para RRHH
(
  '018f4a7c-9999-7000-3333-000000000003',
  '018f4a7c-8888-7000-2222-000000000003',
  '018f4a7c-7777-7000-1111-000000000003',
  '018f4a7c-2222-7000-b000-000000000001',
  '018f4a7c-1111-7000-a000-000000000001',
  '018f4a7c-6666-7000-f000-000000000001',
  'Laura', 'Méndez Ruiz', '70223344', 'rrhh@jyp.com', true, true, 'COMPLETO',
  NOW(), NOW()
),
-- 4. Empleado para ASISTENTE
(
  '018f4a7c-9999-7000-3333-000000000004',
  '018f4a7c-8888-7000-2222-000000000004',
  '018f4a7c-7777-7000-1111-000000000003',
  '018f4a7c-2222-7000-b000-000000000001',
  '018f4a7c-1111-7000-a000-000000000001',
  '018f4a7c-6666-7000-f000-000000000001',
  'Ana', 'Torres Gómez', '70334455', 'asistente@jyp.com', false, true, 'COMPLETO',
  NOW(), NOW()
),
-- 5. Empleado para EMPLEADO (Personal operativo)
(
  '018f4a7c-9999-7000-3333-000000000005',
  '018f4a7c-8888-7000-2222-000000000005',
  '018f4a7c-7777-7000-1111-000000000004',
  '018f4a7c-2222-7000-b000-000000000002',
  '018f4a7c-1111-7000-a000-000000000001',
  '018f4a7c-6666-7000-f000-000000000002',
  'Miguel', 'Ángel Osorio', '001155998', 'miguel.osorio@jyp.com', true, true, 'COMPLETO',
  NOW(), NOW()
),
-- 6. Empleado para JYP (Directivo)
(
  '018f4a7c-9999-7000-3333-000000000006',
  '018f4a7c-8888-7000-2222-000000000006',
  '018f4a7c-7777-7000-1111-000000000001',
  '018f4a7c-2222-7000-b000-000000000001',
  '018f4a7c-1111-7000-a000-000000000001',
  '018f4a7c-6666-7000-f000-000000000001',
  'Jorge', 'Yupanqui Ponce', '70445566', 'jyp@jyp.com', false, true, 'COMPLETO',
  NOW(), NOW()
);