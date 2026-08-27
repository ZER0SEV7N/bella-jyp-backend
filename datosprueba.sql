-- Active: 1785200169721@@localhost@5432@planillas_db
-- =========================================================================
-- SCRIPT DE MOCK DATA - SISTEMA DE PLANILLAS JYP
-- Limpia datos existentes y carga catálogos, áreas, cargos, jornadas,
-- empleados y usuarios con todos los roles del sistema.
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
TRUNCATE TABLE empleados CASCADE;
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

-- Estados de Empleado
INSERT INTO estado_empleado (id, descripcion) VALUES
('018f4a7c-1111-7000-a000-000000000001', 'ACTIVO'),
('018f4a7c-1111-7000-a000-000000000002', 'SUSPENDIDO'),
('018f4a7c-1111-7000-a000-000000000003', 'CESADO');

-- Tipos de Documento
INSERT INTO tipo_documento (id, tipo_documento) VALUES
('018f4a7c-2222-7000-b000-000000000001', 'DNI'),
('018f4a7c-2222-7000-b000-000000000002', 'CE'),
('018f4a7c-2222-7000-b000-000000000003', 'PASAPORTE');

-- Bancos
INSERT INTO bancos (id, nombre) VALUES
('018f4a7c-3333-7000-c000-000000000001', 'BCP'),
('018f4a7c-3333-7000-c000-000000000002', 'BBVA'),
('018f4a7c-3333-7000-c000-000000000003', 'INTERBANK'),
('018f4a7c-3333-7000-c000-000000000004', 'SCOTIABANK');

-- Régimen Pensión
INSERT INTO regimen_pension (id, nombre) VALUES
('018f4a7c-4444-7000-d000-000000000001', 'ONP (Sistema Nacional)'),
('018f4a7c-4444-7000-d000-000000000002', 'AFP (Sistema Privado)');

-- Tipos AFP
INSERT INTO tipo_afp (id, id_regimen, nombre) VALUES
('018f4a7c-5555-7000-e000-000000000001', '018f4a7c-4444-7000-d000-000000000002', 'AFP INTEGRA'),
('018f4a7c-5555-7000-e000-000000000002', '018f4a7c-4444-7000-d000-000000000002', 'AFP PRIMA'),
('018f4a7c-5555-7000-e000-000000000003', '018f4a7c-4444-7000-d000-000000000002', 'AFP HABITAT'),
('018f4a7c-5555-7000-e000-000000000004', '018f4a7c-4444-7000-d000-000000000002', 'AFP PROFUTURO');

-- 3. Estructura Organizacional, Turnos y Cargos

-- Jornadas Laborales
INSERT INTO jornada (id, nombre, tipo_jornada, hora_entrada, hora_salida, tolerancia_minutos, activo) VALUES
('018f4a7c-6666-7000-f000-000000000001', 'Turno Mañana (Oficina)', 'FIJA', '1970-01-01 08:00:00', '1970-01-01 17:00:00', 15, true),
('018f4a7c-6666-7000-f000-000000000002', 'Turno Madrugada (Seguridad)', 'ROTATIVA', '1970-01-01 22:00:00', '1970-01-02 06:00:00', 10, true);

-- Áreas
INSERT INTO area (id, nombre, descripcion, activo) VALUES
('018f4a7c-7777-7000-1111-000000000001', 'Oficina Central / Gerencia', 'Dirección General y TI', true),
('018f4a7c-7777-7000-1111-000000000002', 'Contabilidad y Finanzas', 'Gestión Financiera y Planillas', true),
('018f4a7c-7777-7000-1111-000000000003', 'Recursos Humanos', 'Gestión de Talento y Personal', true),
('018f4a7c-7777-7000-1111-000000000004', 'Seguridad y Operaciones', 'Personal Operativo y Vigilancia', true);

-- Cargos (con su respectivo jornada_sugerida_id)
INSERT INTO cargo (id, id_area, jornada_sugerida_id, nombre, descripcion, activo) VALUES
('018f4a7c-8888-7000-2222-000000000001', '018f4a7c-7777-7000-1111-000000000001', '018f4a7c-6666-7000-f000-000000000001', 'Administrador del Sistema', 'Gestión integral del sistema TI', true),
('018f4a7c-8888-7000-2222-000000000002', '018f4a7c-7777-7000-1111-000000000002', '018f4a7c-6666-7000-f000-000000000001', 'Contador Principal', 'Encargado de Planillas y Cierres', true),
('018f4a7c-8888-7000-2222-000000000003', '018f4a7c-7777-7000-1111-000000000003', '018f4a7c-6666-7000-f000-000000000001', 'Jefe de Recursos Humanos', 'Administración de personal y contratos', true),
('018f4a7c-8888-7000-2222-000000000004', '018f4a7c-7777-7000-1111-000000000003', '018f4a7c-6666-7000-f000-000000000001', 'Asistente de RRHH', 'Apoyo en tareas y marcaciones', true),
('018f4a7c-8888-7000-2222-000000000005', '018f4a7c-7777-7000-1111-000000000004', '018f4a7c-6666-7000-f000-000000000002', 'Vigilante Nocturno', 'Seguridad en sede principal', true),
('018f4a7c-8888-7000-2222-000000000006', '018f4a7c-7777-7000-1111-000000000001', '018f4a7c-6666-7000-f000-000000000001', 'Director Ejecutivo (JYP)', 'Socio Director General', true);

-- 4. Empleados Base (Uno por cada rol)
INSERT INTO empleados (
  id, cargo_id, area_id, documento_id, estado_empleado_id, jornada_id, 
  nombre, apellido, nro_documento, asig_familiar, activo, estado_sincronizacion
) VALUES
-- 1. Empleado para ADMIN
(
  '018f4a7c-9999-7000-3333-000000000001',
  '018f4a7c-8888-7000-2222-000000000001', -- Administrador TI
  '018f4a7c-7777-7000-1111-000000000001', -- Gerencia/Oficina
  '018f4a7c-2222-7000-b000-000000000001', -- DNI
  '018f4a7c-1111-7000-a000-000000000001', -- ACTIVO
  '018f4a7c-6666-7000-f000-000000000001', -- Turno Mañana
  'Administrador', 'Sistema Central', '70000001', false, true, 'COMPLETO'
),
-- 2. Empleado para CONTADOR
(
  '018f4a7c-9999-7000-3333-000000000002',
  '018f4a7c-8888-7000-2222-000000000002', -- Contador
  '018f4a7c-7777-7000-1111-000000000002', -- Contabilidad
  '018f4a7c-2222-7000-b000-000000000001', -- DNI
  '018f4a7c-1111-7000-a000-000000000001', -- ACTIVO
  '018f4a7c-6666-7000-f000-000000000001', -- Turno Mañana
  'Carlos', 'Ramírez Silva', '70112233', false, true, 'COMPLETO'
),
-- 3. Empleado para RRHH
(
  '018f4a7c-9999-7000-3333-000000000003',
  '018f4a7c-8888-7000-2222-000000000003', -- Jefe RRHH
  '018f4a7c-7777-7000-1111-000000000003', -- Recursos Humanos
  '018f4a7c-2222-7000-b000-000000000001', -- DNI
  '018f4a7c-1111-7000-a000-000000000001', -- ACTIVO
  '018f4a7c-6666-7000-f000-000000000001', -- Turno Mañana
  'Laura', 'Méndez Ruiz', '70223344', true, true, 'COMPLETO'
),
-- 4. Empleado para ASISTENTE
(
  '018f4a7c-9999-7000-3333-000000000004',
  '018f4a7c-8888-7000-2222-000000000004', -- Asistente RRHH
  '018f4a7c-7777-7000-1111-000000000003', -- Recursos Humanos
  '018f4a7c-2222-7000-b000-000000000001', -- DNI
  '018f4a7c-1111-7000-a000-000000000001', -- ACTIVO
  '018f4a7c-6666-7000-f000-000000000001', -- Turno Mañana
  'Ana', 'Torres Gómez', '70334455', false, true, 'COMPLETO'
),
-- 5. Empleado para EMPLEADO (Personal operativo)
(
  '018f4a7c-9999-7000-3333-000000000005',
  '018f4a7c-8888-7000-2222-000000000005', -- Vigilante
  '018f4a7c-7777-7000-1111-000000000004', -- Seguridad
  '018f4a7c-2222-7000-b000-000000000002', -- CE
  '018f4a7c-1111-7000-a000-000000000001', -- ACTIVO
  '018f4a7c-6666-7000-f000-000000000002', -- Turno Madrugada
  'Miguel', 'Ángel Osorio', '001155998', true, true, 'COMPLETO'
),
-- 6. Empleado para JYP (Directivo)
(
  '018f4a7c-9999-7000-3333-000000000006',
  '018f4a7c-8888-7000-2222-000000000006', -- Director JYP
  '018f4a7c-7777-7000-1111-000000000001', -- Gerencia
  '018f4a7c-2222-7000-b000-000000000001', -- DNI
  '018f4a7c-1111-7000-a000-000000000001', -- ACTIVO
  '018f4a7c-6666-7000-f000-000000000001', -- Turno Mañana
  'Jorge', 'Yupanqui Ponce', '70445566', false, true, 'COMPLETO'
);

-- 5. Usuarios del Sistema (Todos los roles con contraseña 'Password123!')
INSERT INTO usuarios (
  id, empleado_id, email, password_hash, rol, activo
) VALUES
-- Rol ADMIN
('018f4a7c-aaaa-7000-4444-000000000001', '018f4a7c-9999-7000-3333-000000000001', 'admin@jyp.com', '$argon2id$v=19$m=65536,t=3,p=4$CwEhYsfFOkONvY+KYIyvsw$1FaJv3VfxQhZQuP5vDXiImttKbHaGC0KOWInW/PC+PY','ADMIN',true),
-- Rol CONTADOR
('018f4a7c-aaaa-7000-4444-000000000002','018f4a7c-9999-7000-3333-000000000002', 'contador@jyp.com','$2b$10$K7L/n1zJt8E4yW.3gQo1yO1fJ9SZbM4.p/uH7u0dK2rJ5n.0eX2fG','CONTADOR',true),
-- Rol RRHH
('018f4a7c-aaaa-7000-4444-000000000003', '018f4a7c-9999-7000-3333-000000000003', 'rrhh@jyp.com', '$argon2id$v=19$m=65536,t=3,p=4$CwEhYsfFOkONvY+KYIyvsw$1FaJv3VfxQhZQuP5vDXiImttKbHaGC0KOWInW/PC+PY','RRHH',true),
-- Rol ASISTENTE
('018f4a7c-aaaa-7000-4444-000000000004','018f4a7c-9999-7000-3333-000000000004', 'asistente@jyp.com','$2b$10$K7L/n1zJt8E4yW.3gQo1yO1fJ9SZbM4.p/uH7u0dK2rJ5n.0eX2fG', 'ASISTENTE', true),
-- Rol EMPLEADO
('018f4a7c-aaaa-7000-4444-000000000005', '018f4a7c-9999-7000-3333-000000000005', 'empleado@jyp.com','$argon2id$v=19$m=65536,t=3,p=4$CwEhYsfFOkONvY+KYIyvsw$1FaJv3VfxQhZQuP5vDXiImttKbHaGC0KOWInW/PC+PY', 'EMPLEADO', true),
-- Rol JYP
('018f4a7c-aaaa-7000-4444-000000000006', '018f4a7c-9999-7000-3333-000000000006', 'jyp@jyp.com', '$argon2id$v=19$m=65536,t=3,p=4$CwEhYsfFOkONvY+KYIyvsw$1FaJv3VfxQhZQuP5vDXiImttKbHaGC0KOWInW/PC+PY', 'JYP', true);