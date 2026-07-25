-- Active: 1783116194814@@127.0.0.1@5432@planillas_db
-- =========================================================================
-- SCRIPT DE MOCK DATA - SISTEMA DE PLANILLAS JYP
-- Limpia datos existentes y carga catálogos base y un par de empleados
-- =========================================================================

-- 1. Limpieza de tablas (Cascada para evitar bloqueos)
TRUNCATE TABLE empleados CASCADE;
TRUNCATE TABLE jornada CASCADE;
TRUNCATE TABLE cargo CASCADE;
TRUNCATE TABLE area CASCADE;
TRUNCATE TABLE tipo_documento CASCADE;
TRUNCATE TABLE estado_empleado CASCADE;
TRUNCATE TABLE estado_contrato CASCADE;
TRUNCATE TABLE regimen_pension CASCADE;
TRUNCATE TABLE tipo_afp CASCADE;
TRUNCATE TABLE bancos CASCADE;

-- 2. Catálogos Base (Usamos UUIDs genéricos deterministas para mantener FKs intactas)

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

-- Tipos AFP (Relacionados al Régimen AFP '...0002')
INSERT INTO tipo_afp (id, id_regimen, nombre) VALUES
('018f4a7c-5555-7000-e000-000000000001', '018f4a7c-4444-7000-d000-000000000002', 'AFP INTEGRA'),
('018f4a7c-5555-7000-e000-000000000002', '018f4a7c-4444-7000-d000-000000000002', 'AFP PRIMA'),
('018f4a7c-5555-7000-e000-000000000003', '018f4a7c-4444-7000-d000-000000000002', 'AFP HABITAT'),
('018f4a7c-5555-7000-e000-000000000004', '018f4a7c-4444-7000-d000-000000000002', 'AFP PROFUTURO');

-- 3. Estructura Organizacional y Turnos

-- Jornadas Laborales
INSERT INTO jornada (id, nombre, hora_entrada, hora_salida, tolerancia_minutos, activo) VALUES
('018f4a7c-6666-7000-f000-000000000001', 'Turno Mañana (Oficina)', '1970-01-01 08:00:00', '1970-01-01 17:00:00', 15, true),
('018f4a7c-6666-7000-f000-000000000002', 'Turno Madrugada (Seguridad)', '1970-01-01 22:00:00', '1970-01-02 06:00:00', 10, true);

-- Áreas
INSERT INTO area (id, nombre, descripcion, activo) VALUES
('018f4a7c-7777-7000-1111-000000000001', 'Oficina Central', 'Administración y Finanzas', true),
('018f4a7c-7777-7000-1111-000000000002', 'Seguridad Física', 'Personal de Vigilancia', true),
('018f4a7c-7777-7000-1111-000000000003', 'Limpieza', 'Mantenimiento General', true);

-- Cargos (Vinculados a Áreas)
INSERT INTO cargo (id, id_area, nombre, descripcion, activo) VALUES
('018f4a7c-8888-7000-2222-000000000001', '018f4a7c-7777-7000-1111-000000000001', 'Contador Principal', 'Jefe de Planillas', true),
('018f4a7c-8888-7000-2222-000000000002', '018f4a7c-7777-7000-1111-000000000002', 'Vigilante Nocturno', 'Seguridad Sede Central', true);

-- 4. Empleados de Prueba
INSERT INTO empleados (
  id, cargo_id, area_id, documento_id, estado_empleado_id, jornada_id, 
  nombre, apellido, nro_documento, asig_familiar, activo, estado_sincronizacion
) VALUES
-- Empleado 1: Contador (Turno Mañana, DNI)
(
  '018f4a7c-9999-7000-3333-000000000001', 
  '018f4a7c-8888-7000-2222-000000000001', -- Cargo Contador
  '018f4a7c-7777-7000-1111-000000000001', -- Área Oficina
  '018f4a7c-2222-7000-b000-000000000001', -- DNI
  '018f4a7c-1111-7000-a000-000000000001', -- Estado Activo
  '018f4a7c-6666-7000-f000-000000000001', -- Turno Mañana
  'Carlos', 'Ramirez Silva', '70112233', false, true, 'COMPLETO'
),
-- Empleado 2: Seguridad (Turno Madrugada, CE, Tiene hijos/Asig_familiar)
(
  '018f4a7c-9999-7000-3333-000000000002', 
  '018f4a7c-8888-7000-2222-000000000002', -- Cargo Vigilante
  '018f4a7c-7777-7000-1111-000000000002', -- Área Seguridad
  '018f4a7c-2222-7000-b000-000000000002', -- CE
  '018f4a7c-1111-7000-a000-000000000001', -- Estado Activo
  '018f4a7c-6666-7000-f000-000000000002', -- Turno Madrugada
  'Miguel', 'Ángel Osorio', '001155998', true, true, 'COMPLETO'
);