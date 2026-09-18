-- =========================================================================
-- SCRIPT DE MOCK DATA - SISTEMA DE PLANILLAS JYP (CORREGIDO)
-- =========================================================================

-- 1. Limpieza de tablas (Cascada)
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
-- o empleado si tienes @@map("empleado")
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

-- 2. Catálogos Base
INSERT INTO estado_empleado (id, descripcion)
VALUES ('018f4a7c-1111-7000-a000-000000000001','ACTIVO'), ('018f4a7c-1111-7000-a000-000000000002', 'SUSPENDIDO'), ('018f4a7c-1111-7000-a000-000000000003', 'CESADO');

INSERT INTO tipo_documento (id, tipo_documento)
VALUES ('018f4a7c-2222-7000-b000-000000000001','DNI'),('018f4a7c-2222-7000-b000-000000000002','CE'),('018f4a7c-2222-7000-b000-000000000003','PASAPORTE');

INSERT INTO bancos (id, nombre)
VALUES ('018f4a7c-3333-7000-c000-000000000001','Banco de Crédito del Perú (BCP)'),
('018f4a7c-3333-7000-c000-000000000002','BBVA Continental'), ('018f4a7c-3333-7000-c000-000000000003','Interbank'),('018f4a7c-3333-7000-c000-000000000004','Scotiabank Perú');

INSERT INTO regimen_pension (id, nombre)
VALUES ('018f4a7c-4444-7000-d000-000000000001', 'ONP (Sistema Nacional)' ), ('018f4a7c-4444-7000-d000-000000000002', 'SPP (Sistema Privado - AFP)' );

INSERT INTO tipo_afp (id, id_regimen, nombre)
VALUES ('018f4a7c-5555-7000-e000-000000000001', '018f4a7c-4444-7000-d000-000000000002', 'AFP INTEGRA'),
('018f4a7c-5555-7000-e000-000000000002', '018f4a7c-4444-7000-d000-000000000002', 'AFP PRIMA'),
('018f4a7c-5555-7000-e000-000000000003', '018f4a7c-4444-7000-d000-000000000002', 'AFP HABITAT'),
('018f4a7c-5555-7000-e000-000000000004', '018f4a7c-4444-7000-d000-000000000002', 'AFP PROFUTURO');

-- 3. Áreas
INSERT INTO area(id,nombre,descripcion,activo)
VALUES ('018f4a7c-7777-7000-1111-000000000001','Oficina Central / Gerencia','Dirección General y TI',true),
('018f4a7c-7777-7000-1111-000000000002','Contabilidad y Finanzas','Gestión Financiera y Planillas',true),
('018f4a7c-7777-7000-1111-000000000003','Recursos Humanos','Gestión de Talento y Personal',true),
('018f4a7c-7777-7000-1111-000000000004','Seguridad y Operaciones','Personal Operativo y Vigilancia',true);

-- 4. Jornadas Laborales
INSERT INTO jornada (id,nombre,descripcion,duracion,turno,modalidad,tolerancia_minutos,total_horas_semana,horario_semanal,activo,created_at,updated_at)
VALUES ('018f4a7c-6666-7000-f000-000000000001','Jornada Estándar Oficina','Horario administrativo de 40h semanales de Lunes a Viernes','TIEMPO_COMPLETO','MANANA','PRESENCIAL',15,40.00,
'[
    {"dia": "LUNES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "08:00", "inicio_descanso": "13:00", "fin_descanso": "14:00", "salida": "17:00", "total_horas": 8},
    {"dia": "MARTES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "08:00", "inicio_descanso": "13:00", "fin_descanso": "14:00", "salida": "17:00", "total_horas": 8},
    {"dia": "MIERCOLES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "08:00", "inicio_descanso": "13:00", "fin_descanso": "14:00", "salida": "17:00", "total_horas": 8},
    {"dia": "JUEVES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "08:00", "inicio_descanso": "13:00", "fin_descanso": "14:00", "salida": "17:00", "total_horas": 8},
    {"dia": "VIERNES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "08:00", "inicio_descanso": "13:00", "fin_descanso": "14:00", "salida": "17:00", "total_horas": 8},
    {"dia": "SABADO", "laborable": false, "modalidad": "PRESENCIAL", "entrada": null, "inicio_descanso": null, "fin_descanso": null, "salida": null, "total_horas": 0},
    {"dia": "DOMINGO", "laborable": false, "modalidad": "PRESENCIAL", "entrada": null, "inicio_descanso": null, "fin_descanso": null, "salida": null, "total_horas": 0}
]'::jsonb,true,NOW(),NOW()),
('018f4a7c-6666-7000-f000-000000000002','Turno Nocturno Seguridad','Turno de noche para vigilancia y control de acceso','TIEMPO_COMPLETO','NOCHE','PRESENCIAL',10,40.00,
'[
    {"dia": "LUNES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "22:00", "inicio_descanso": null, "fin_descanso": null, "salida": "06:00", "total_horas": 8},
    {"dia": "MARTES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "22:00", "inicio_descanso": null, "fin_descanso": null, "salida": "06:00", "total_horas": 8},
    {"dia": "MIERCOLES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "22:00", "inicio_descanso": null, "fin_descanso": null, "salida": "06:00", "total_horas": 8},
    {"dia": "JUEVES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "22:00", "inicio_descanso": null, "fin_descanso": null, "salida": "06:00", "total_horas": 8},
    {"dia": "VIERNES", "laborable": true, "modalidad": "PRESENCIAL", "entrada": "22:00", "inicio_descanso": null, "fin_descanso": null, "salida": "06:00", "total_horas": 8},
    {"dia": "SABADO", "laborable": false, "modalidad": "PRESENCIAL", "entrada": null, "inicio_descanso": null, "fin_descanso": null, "salida": null, "total_horas": 0},
    {"dia": "DOMINGO", "laborable": false, "modalidad": "PRESENCIAL", "entrada": null, "inicio_descanso": null, "fin_descanso": null, "salida": null, "total_horas": 0}
]'::jsonb,true,NOW(),NOW());

-- 5. Jornada <-> Áreas
INSERT INTO jornada_area (jornada_id, area_id)
VALUES ('018f4a7c-6666-7000-f000-000000000001','018f4a7c-7777-7000-1111-000000000001'),
('018f4a7c-6666-7000-f000-000000000001','018f4a7c-7777-7000-1111-000000000002'),
('018f4a7c-6666-7000-f000-000000000001','018f4a7c-7777-7000-1111-000000000003'),
('018f4a7c-6666-7000-f000-000000000002','018f4a7c-7777-7000-1111-000000000004');

-- 6. Cargos
INSERT INTO cargo (id,id_area,nombre,descripcion,sueldo_minimo,sueldo_maximo,activo)
VALUES ('018f4a7c-8888-7000-2222-000000000001','018f4a7c-7777-7000-1111-000000000001','Administrador del Sistema','Gestión integral del sistema TI',3500.00,6000.00,true),
('018f4a7c-8888-7000-2222-000000000002','018f4a7c-7777-7000-1111-000000000002','Contador Principal','Encargado de Planillas y Cierres',3000.00,5000.00,true),
('018f4a7c-8888-7000-2222-000000000003','018f4a7c-7777-7000-1111-000000000003','Jefe de Recursos Humanos','Administración de personal y contratos',3500.00,5500.00,true),
('018f4a7c-8888-7000-2222-000000000004','018f4a7c-7777-7000-1111-000000000003','Asistente de RRHH','Apoyo en tareas y marcaciones',1500.00,2500.00,true),
('018f4a7c-8888-7000-2222-000000000005','018f4a7c-7777-7000-1111-000000000004','Vigilante Nocturno','Seguridad en sede principal',1300.00,2000.00,true),
('018f4a7c-8888-7000-2222-000000000006','018f4a7c-7777-7000-1111-000000000001','Director Ejecutivo (JYP)','Socio Director General',6000.00,12000.00,true);

-- 7. Empleados Base (Usando 'empleados')
INSERT INTO empleado (id,cargo_id,area_id,documento_id,estado_empleado_id,jornada_id,nombre,apellido,nro_documento,email,asig_familiar,activo,estado_sincronizacion,fecha_nacimiento,fecha_inicio,created_at,updated_at)
VALUES ('018f4a7c-9999-7000-3333-000000000001','018f4a7c-8888-7000-2222-000000000001','018f4a7c-7777-7000-1111-000000000001','018f4a7c-2222-7000-b000-000000000001','018f4a7c-1111-7000-a000-000000000001','018f4a7c-6666-7000-f000-000000000001','Administrador','Sistema Central','70000001','admin@jyp.com',false,true,'COMPLETO','1990-01-01','2024-01-01',NOW(),NOW()),
('018f4a7c-9999-7000-3333-000000000002','018f4a7c-8888-7000-2222-000000000002','018f4a7c-7777-7000-1111-000000000002','018f4a7c-2222-7000-b000-000000000001','018f4a7c-1111-7000-a000-000000000001','018f4a7c-6666-7000-f000-000000000001','Carlos','Ramírez Silva','70112233','contador@jyp.com',false,true,'COMPLETO','1988-06-15','2024-02-01',NOW(),NOW()),
('018f4a7c-9999-7000-3333-000000000003','018f4a7c-8888-7000-2222-000000000003','018f4a7c-7777-7000-1111-000000000003','018f4a7c-2222-7000-b000-000000000001','018f4a7c-1111-7000-a000-000000000001','018f4a7c-6666-7000-f000-000000000001','Laura','Méndez Ruiz','70223344','rrhh@jyp.com',true,true,'COMPLETO','1992-09-20','2024-03-01',NOW(),NOW()),
('018f4a7c-9999-7000-3333-000000000004','018f4a7c-8888-7000-2222-000000000004','018f4a7c-7777-7000-1111-000000000003','018f4a7c-2222-7000-b000-000000000001','018f4a7c-1111-7000-a000-000000000001','018f4a7c-6666-7000-f000-000000000001','Ana','Torres Gómez','70334455','asistente@jyp.com',false,true,'COMPLETO','1996-04-12','2024-04-01',NOW(),NOW()),
('018f4a7c-9999-7000-3333-000000000005','018f4a7c-8888-7000-2222-000000000005','018f4a7c-7777-7000-1111-000000000004','018f4a7c-2222-7000-b000-000000000002','018f4a7c-1111-7000-a000-000000000001','018f4a7c-6666-7000-f000-000000000002','Miguel','Ángel Osorio','001155998','miguel.osorio@jyp.com',true,true,'COMPLETO','1985-11-30','2024-05-01',NOW(),NOW()),
('018f4a7c-9999-7000-3333-000000000006','018f4a7c-8888-7000-2222-000000000006','018f4a7c-7777-7000-1111-000000000001','018f4a7c-2222-7000-b000-000000000001','018f4a7c-1111-7000-a000-000000000001','018f4a7c-6666-7000-f000-000000000001','Jorge','Yupanqui Ponce','70445566','jyp@jyp.com',false,true,'COMPLETO','1980-03-05','2024-01-01',NOW(),NOW());


-- 8. Datos Financieros Iniciales (Ejemplo para Carlos Ramírez - Contador)
-- Cuentas mock para Sueldo (BCP) y CTS (BBVA) con régimen Essalud Regular
INSERT INTO dato_financiero (id,empleado_id,id_regimen,id_tipo_afp,sueldo_basico,cuspp,tipo_comision,id_banco_sueldo,tipo_cuenta_sueldo,nro_cuenta_sueldo,cci_sueldo,id_banco_cts,tipo_cuenta_cts,nro_cuenta_cts,cci_cts,regimen_salud,eps_costo_adicional,created_at,updated_at)
VALUES (
        '018f4a7c-bbbb-7000-5555-000000000001',
        '018f4a7c-9999-7000-3333-000000000002', -- Carlos Ramírez
        '018f4a7c-4444-7000-d000-000000000002', -- AFP
        '018f4a7c-5555-7000-e000-000000000001', -- AFP INTEGRA
        3500.0000,
        '123456CRM001',
        'FLUJO',
        '018f4a7c-3333-7000-c000-000000000001', -- BCP Sueldo
        'SUELDO',
        '191-12345678-0-12', -- En pruebas directas se descifrará con fallback o vía use case
        '002-191-00123456780123-88',
        '018f4a7c-3333-7000-c000-000000000002', -- BBVA CTS
        'AHORROS',
        '0011-0123-45-0100012345',
        '011-123-000100012345-67',
        'ESSALUD_REGULAR',
        0.0000,
        NOW(),
        NOW()
    );