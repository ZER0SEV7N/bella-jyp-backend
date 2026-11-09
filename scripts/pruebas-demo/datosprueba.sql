-- ================================================================================================
-- DATOS DE PRUEBA N8N: 10 PERSONAS FICTICIAS, SEPTIEMBRE 2026 (UTF-8)
-- ================================================================================================
-- Propósito:
--   Instalar los 10 empleados ficticios (`019a0000-0001-7000-8000-000000000001..10`) para probar
--   la importación de asistencia Excel, cálculo de planilla y exportación documental con n8n.
--
-- Compatibilidad y convivencia sin colisión:
--   - Puede ejecutarse en la misma base de datos donde ya se haya corrido `scripts/datosprueba.sql`
--     (los 3 empleados de prueba para Postman) o antes de aquel, sin colisionar entre sí.
--   - Es completamente idempotente y compatible con el botón "▷ Run" de VS Code SQLTools,
--     pgAdmin, DBeaver o `node scripts/aplicar-sql.cjs demo-10`.
--   - Clave pública de prueba: Demo_JYP_2026! (`empleado1@example.test` .. `empleado10@example.test`).
-- ================================================================================================

SET client_encoding = 'UTF8';

SET app.entorno_pruebas = 'SI';

BEGIN;

DO $$
DECLARE
    v_dni_id uuid;
    v_onp_id uuid;
    v_spp_id uuid;
    v_integra_id uuid;
    v_bcp_id uuid;
    v_horario_40h jsonb := '[{"dia":"DOMINGO","laborable":false,"modalidad":"PRESENCIAL","entrada":"09:00","inicio_descanso":"13:00","fin_descanso":"14:00","salida":"18:00"},{"dia":"LUNES","laborable":true,"modalidad":"PRESENCIAL","entrada":"09:00","inicio_descanso":"13:00","fin_descanso":"14:00","salida":"18:00"},{"dia":"MARTES","laborable":true,"modalidad":"PRESENCIAL","entrada":"09:00","inicio_descanso":"13:00","fin_descanso":"14:00","salida":"18:00"},{"dia":"MIERCOLES","laborable":true,"modalidad":"PRESENCIAL","entrada":"09:00","inicio_descanso":"13:00","fin_descanso":"14:00","salida":"18:00"},{"dia":"JUEVES","laborable":true,"modalidad":"PRESENCIAL","entrada":"09:00","inicio_descanso":"13:00","fin_descanso":"14:00","salida":"18:00"},{"dia":"VIERNES","laborable":true,"modalidad":"PRESENCIAL","entrada":"09:00","inicio_descanso":"13:00","fin_descanso":"14:00","salida":"18:00"},{"dia":"SABADO","laborable":false,"modalidad":"PRESENCIAL","entrada":"09:00","inicio_descanso":"13:00","fin_descanso":"14:00","salida":"18:00"}]'::jsonb;
BEGIN
    PERFORM set_config('app.entorno_pruebas', 'SI', true);

    IF current_setting('app.entorno_pruebas', true) IS DISTINCT FROM 'SI' THEN
        RAISE EXCEPTION 'Active app.entorno_pruebas=SI solo en una BD de demostración';
    END IF;

    -- Comprueba únicamente el primer empleado del lote n8n (019a0000-0001-...0001).
    -- Así no falla si ya están cargados los 3 empleados de Postman (019a0100-...0010..12).
    IF EXISTS (
        SELECT 1 FROM empleados
        WHERE id = '019a0000-0001-7000-8000-000000000001'
    ) THEN
        RAISE NOTICE 'La demostración n8n (10 empleados) ya está instalada; no se modificó.';
        RETURN;
    END IF;

    SELECT id INTO v_dni_id FROM tipo_documento WHERE tipo_documento = 'DNI' LIMIT 1;
    SELECT id INTO v_onp_id FROM regimen_pension WHERE nombre = 'ONP' LIMIT 1;
    SELECT id INTO v_spp_id FROM regimen_pension WHERE nombre = 'SPP' LIMIT 1;
    SELECT id INTO v_integra_id FROM tipo_afp WHERE nombre = 'INTEGRA' LIMIT 1;
    SELECT id INTO v_bcp_id FROM bancos WHERE nombre = 'BANCO DE CREDITO DEL PERU (BCP)' LIMIT 1;

    IF v_dni_id IS NULL OR v_onp_id IS NULL OR v_spp_id IS NULL OR v_integra_id IS NULL OR v_bcp_id IS NULL THEN
        RAISE EXCEPTION 'Ejecute primero `npx prisma db seed` (o `pnpm db:seed`) para crear los catálogos base.';
    END IF;

    -- 1. ORGANIZACIÓN DE PRUEBA. Los seeders operativos no crean áreas ni personas.
    INSERT INTO area(id,nombre,descripcion) VALUES ('019a0000-0003-7000-8000-000000000001','Oficina DEMO','Área ficticia de demostración') ON CONFLICT (id) DO NOTHING;
    INSERT INTO cargo(id,id_area,nombre,sueldo_minimo,sueldo_maximo) VALUES ('019a0000-0004-7000-8000-000000000001','019a0000-0003-7000-8000-000000000001','Operador DEMO 1',1130,5000) ON CONFLICT (id) DO NOTHING;
    INSERT INTO area(id,nombre,descripcion) VALUES ('019a0000-0003-7000-8000-000000000002','Seguridad DEMO','Área ficticia de demostración') ON CONFLICT (id) DO NOTHING;
    INSERT INTO cargo(id,id_area,nombre,sueldo_minimo,sueldo_maximo) VALUES ('019a0000-0004-7000-8000-000000000002','019a0000-0003-7000-8000-000000000002','Operador DEMO 2',1130,5000) ON CONFLICT (id) DO NOTHING;
    INSERT INTO area(id,nombre,descripcion) VALUES ('019a0000-0003-7000-8000-000000000003','Limpieza DEMO','Área ficticia de demostración') ON CONFLICT (id) DO NOTHING;
    INSERT INTO cargo(id,id_area,nombre,sueldo_minimo,sueldo_maximo) VALUES ('019a0000-0004-7000-8000-000000000003','019a0000-0003-7000-8000-000000000003','Operador DEMO 3',1130,5000) ON CONFLICT (id) DO NOTHING;

    -- 2. JORNADA DIURNA FIJA: lunes a viernes, 09–18 h y una hora de refrigerio (40 horas/semana).
    INSERT INTO jornada(id,nombre,descripcion,horario_semanal,total_horas_semana,tolerancia_minutos)
    VALUES ('019a0000-0005-7000-8000-000000000001','DEMO 40 HORAS','Horario ficticio para comprobar el motor',v_horario_40h,40,5)
    ON CONFLICT (id) DO NOTHING;

    -- 3. EMPLEADOS COMPLETOS. Todos ingresan el 01/09 para no exigir historia previa.
    INSERT INTO empleados(id,cargo_id,area_id,documento_id,jornada_id,nombre,apellido,nro_documento,email,telefono,sexo,fecha_nacimiento,direccion,referencia_direccion,ubigeo,distrito,provincia,departamento,fecha_inicio,afp_fecha_filiacion)
    VALUES ('019a0000-0001-7000-8000-000000000001','019a0000-0004-7000-8000-000000000001','019a0000-0003-7000-8000-000000000001',v_dni_id,'019a0000-0005-7000-8000-000000000001','Ana','Ramos Demo','09900001','empleado1@example.test','900000000','MASCULINO','1990-01-15','Av. Prueba 100','Domicilio ficticio','150101','LIMA','LIMA','LIMA','2026-09-01',NULL) ON CONFLICT (id) DO NOTHING;
    INSERT INTO empleados(id,cargo_id,area_id,documento_id,jornada_id,nombre,apellido,nro_documento,email,telefono,sexo,fecha_nacimiento,direccion,referencia_direccion,ubigeo,distrito,provincia,departamento,fecha_inicio,afp_fecha_filiacion)
    VALUES ('019a0000-0001-7000-8000-000000000002','019a0000-0004-7000-8000-000000000002','019a0000-0003-7000-8000-000000000002',v_dni_id,'019a0000-0005-7000-8000-000000000001','Luis','Vega Demo','09900002','empleado2@example.test','900000000','MASCULINO','1990-01-15','Av. Prueba 100','Domicilio ficticio','150101','LIMA','LIMA','LIMA','2026-09-01',NULL) ON CONFLICT (id) DO NOTHING;
    INSERT INTO empleados(id,cargo_id,area_id,documento_id,jornada_id,nombre,apellido,nro_documento,email,telefono,sexo,fecha_nacimiento,direccion,referencia_direccion,ubigeo,distrito,provincia,departamento,fecha_inicio,afp_fecha_filiacion)
    VALUES ('019a0000-0001-7000-8000-000000000003','019a0000-0004-7000-8000-000000000003','019a0000-0003-7000-8000-000000000003',v_dni_id,'019a0000-0005-7000-8000-000000000001','Marta','Torres Demo','09900003','empleado3@example.test','900000000','MASCULINO','1990-01-15','Av. Prueba 100','Domicilio ficticio','150101','LIMA','LIMA','LIMA','2026-09-01',NULL) ON CONFLICT (id) DO NOTHING;
    INSERT INTO empleados(id,cargo_id,area_id,documento_id,jornada_id,nombre,apellido,nro_documento,email,telefono,sexo,fecha_nacimiento,direccion,referencia_direccion,ubigeo,distrito,provincia,departamento,fecha_inicio,afp_fecha_filiacion)
    VALUES ('019a0000-0001-7000-8000-000000000004','019a0000-0004-7000-8000-000000000001','019a0000-0003-7000-8000-000000000001',v_dni_id,'019a0000-0005-7000-8000-000000000001','Jose','Soto Demo','09900004','empleado4@example.test','900000000','MASCULINO','1990-01-15','Av. Prueba 100','Domicilio ficticio','150101','LIMA','LIMA','LIMA','2026-09-01',NULL) ON CONFLICT (id) DO NOTHING;
    INSERT INTO empleados(id,cargo_id,area_id,documento_id,jornada_id,nombre,apellido,nro_documento,email,telefono,sexo,fecha_nacimiento,direccion,referencia_direccion,ubigeo,distrito,provincia,departamento,fecha_inicio,afp_fecha_filiacion)
    VALUES ('019a0000-0001-7000-8000-000000000005','019a0000-0004-7000-8000-000000000002','019a0000-0003-7000-8000-000000000002',v_dni_id,'019a0000-0005-7000-8000-000000000001','Rosa','Diaz Demo','09900005','empleado5@example.test','900000000','MASCULINO','1990-01-15','Av. Prueba 100','Domicilio ficticio','150101','LIMA','LIMA','LIMA','2026-09-01',NULL) ON CONFLICT (id) DO NOTHING;
    INSERT INTO empleados(id,cargo_id,area_id,documento_id,jornada_id,nombre,apellido,nro_documento,email,telefono,sexo,fecha_nacimiento,direccion,referencia_direccion,ubigeo,distrito,provincia,departamento,fecha_inicio,afp_fecha_filiacion)
    VALUES ('019a0000-0001-7000-8000-000000000006','019a0000-0004-7000-8000-000000000003','019a0000-0003-7000-8000-000000000003',v_dni_id,'019a0000-0005-7000-8000-000000000001','Diego','Luna Demo','09900006','empleado6@example.test','900000000','MASCULINO','1990-01-15','Av. Prueba 100','Domicilio ficticio','150101','LIMA','LIMA','LIMA','2026-09-01','2026-09-01') ON CONFLICT (id) DO NOTHING;
    INSERT INTO empleados(id,cargo_id,area_id,documento_id,jornada_id,nombre,apellido,nro_documento,email,telefono,sexo,fecha_nacimiento,direccion,referencia_direccion,ubigeo,distrito,provincia,departamento,fecha_inicio,afp_fecha_filiacion)
    VALUES ('019a0000-0001-7000-8000-000000000007','019a0000-0004-7000-8000-000000000001','019a0000-0003-7000-8000-000000000001',v_dni_id,'019a0000-0005-7000-8000-000000000001','Lucia','Rojas Demo','09900007','empleado7@example.test','900000000','MASCULINO','1990-01-15','Av. Prueba 100','Domicilio ficticio','150101','LIMA','LIMA','LIMA','2026-09-01','2026-09-01') ON CONFLICT (id) DO NOTHING;
    INSERT INTO empleados(id,cargo_id,area_id,documento_id,jornada_id,nombre,apellido,nro_documento,email,telefono,sexo,fecha_nacimiento,direccion,referencia_direccion,ubigeo,distrito,provincia,departamento,fecha_inicio,afp_fecha_filiacion)
    VALUES ('019a0000-0001-7000-8000-000000000008','019a0000-0004-7000-8000-000000000002','019a0000-0003-7000-8000-000000000002',v_dni_id,'019a0000-0005-7000-8000-000000000001','Pedro','Reyes Demo','09900008','empleado8@example.test','900000000','MASCULINO','1990-01-15','Av. Prueba 100','Domicilio ficticio','150101','LIMA','LIMA','LIMA','2026-09-01','2026-09-01') ON CONFLICT (id) DO NOTHING;
    INSERT INTO empleados(id,cargo_id,area_id,documento_id,jornada_id,nombre,apellido,nro_documento,email,telefono,sexo,fecha_nacimiento,direccion,referencia_direccion,ubigeo,distrito,provincia,departamento,fecha_inicio,afp_fecha_filiacion)
    VALUES ('019a0000-0001-7000-8000-000000000009','019a0000-0004-7000-8000-000000000003','019a0000-0003-7000-8000-000000000003',v_dni_id,'019a0000-0005-7000-8000-000000000001','Elena','Paz Demo','09900009','empleado9@example.test','900000000','MASCULINO','1990-01-15','Av. Prueba 100','Domicilio ficticio','150101','LIMA','LIMA','LIMA','2026-09-01','2026-09-01') ON CONFLICT (id) DO NOTHING;
    INSERT INTO empleados(id,cargo_id,area_id,documento_id,jornada_id,nombre,apellido,nro_documento,email,telefono,sexo,fecha_nacimiento,direccion,referencia_direccion,ubigeo,distrito,provincia,departamento,fecha_inicio,afp_fecha_filiacion)
    VALUES ('019a0000-0001-7000-8000-000000000010','019a0000-0004-7000-8000-000000000001','019a0000-0003-7000-8000-000000000001',v_dni_id,'019a0000-0005-7000-8000-000000000001','Marco','Leon Demo','09900010','empleado10@example.test','900000000','MASCULINO','1990-01-15','Av. Prueba 100','Domicilio ficticio','150101','LIMA','LIMA','LIMA','2026-09-01','2026-09-01') ON CONFLICT (id) DO NOTHING;

    -- 4. USUARIOS DE CADA ROL. El hash Argon2 corresponde a la clave pública de prueba Demo_JYP_2026!.
    INSERT INTO usuarios(id,empleado_id,email,password_hash,rol) VALUES ('019a0000-0002-7000-8000-000000000001','019a0000-0001-7000-8000-000000000001','empleado1@example.test','$argon2id$v=19$m=65536,t=3,p=4$qmgrJLMfoqS8uQ8+CH/xVQ$VfTNo1nIIv3tPM450T0XTlcEA+RGTPPJNZZ9yHABqNQ','ADMIN') ON CONFLICT (id) DO NOTHING;
    INSERT INTO usuarios(id,empleado_id,email,password_hash,rol) VALUES ('019a0000-0002-7000-8000-000000000002','019a0000-0001-7000-8000-000000000002','empleado2@example.test','$argon2id$v=19$m=65536,t=3,p=4$qmgrJLMfoqS8uQ8+CH/xVQ$VfTNo1nIIv3tPM450T0XTlcEA+RGTPPJNZZ9yHABqNQ','RRHH') ON CONFLICT (id) DO NOTHING;
    INSERT INTO usuarios(id,empleado_id,email,password_hash,rol) VALUES ('019a0000-0002-7000-8000-000000000003','019a0000-0001-7000-8000-000000000003','empleado3@example.test','$argon2id$v=19$m=65536,t=3,p=4$qmgrJLMfoqS8uQ8+CH/xVQ$VfTNo1nIIv3tPM450T0XTlcEA+RGTPPJNZZ9yHABqNQ','CONTADOR') ON CONFLICT (id) DO NOTHING;
    INSERT INTO usuarios(id,empleado_id,email,password_hash,rol) VALUES ('019a0000-0002-7000-8000-000000000004','019a0000-0001-7000-8000-000000000004','empleado4@example.test','$argon2id$v=19$m=65536,t=3,p=4$qmgrJLMfoqS8uQ8+CH/xVQ$VfTNo1nIIv3tPM450T0XTlcEA+RGTPPJNZZ9yHABqNQ','ASISTENTE') ON CONFLICT (id) DO NOTHING;
    INSERT INTO usuarios(id,empleado_id,email,password_hash,rol) VALUES ('019a0000-0002-7000-8000-000000000005','019a0000-0001-7000-8000-000000000005','empleado5@example.test','$argon2id$v=19$m=65536,t=3,p=4$qmgrJLMfoqS8uQ8+CH/xVQ$VfTNo1nIIv3tPM450T0XTlcEA+RGTPPJNZZ9yHABqNQ','EMPLEADO') ON CONFLICT (id) DO NOTHING;
    INSERT INTO usuarios(id,empleado_id,email,password_hash,rol) VALUES ('019a0000-0002-7000-8000-000000000006','019a0000-0001-7000-8000-000000000006','empleado6@example.test','$argon2id$v=19$m=65536,t=3,p=4$qmgrJLMfoqS8uQ8+CH/xVQ$VfTNo1nIIv3tPM450T0XTlcEA+RGTPPJNZZ9yHABqNQ','EMPLEADO') ON CONFLICT (id) DO NOTHING;
    INSERT INTO usuarios(id,empleado_id,email,password_hash,rol) VALUES ('019a0000-0002-7000-8000-000000000007','019a0000-0001-7000-8000-000000000007','empleado7@example.test','$argon2id$v=19$m=65536,t=3,p=4$qmgrJLMfoqS8uQ8+CH/xVQ$VfTNo1nIIv3tPM450T0XTlcEA+RGTPPJNZZ9yHABqNQ','EMPLEADO') ON CONFLICT (id) DO NOTHING;
    INSERT INTO usuarios(id,empleado_id,email,password_hash,rol) VALUES ('019a0000-0002-7000-8000-000000000008','019a0000-0001-7000-8000-000000000008','empleado8@example.test','$argon2id$v=19$m=65536,t=3,p=4$qmgrJLMfoqS8uQ8+CH/xVQ$VfTNo1nIIv3tPM450T0XTlcEA+RGTPPJNZZ9yHABqNQ','EMPLEADO') ON CONFLICT (id) DO NOTHING;
    INSERT INTO usuarios(id,empleado_id,email,password_hash,rol) VALUES ('019a0000-0002-7000-8000-000000000009','019a0000-0001-7000-8000-000000000009','empleado9@example.test','$argon2id$v=19$m=65536,t=3,p=4$qmgrJLMfoqS8uQ8+CH/xVQ$VfTNo1nIIv3tPM450T0XTlcEA+RGTPPJNZZ9yHABqNQ','EMPLEADO') ON CONFLICT (id) DO NOTHING;
    INSERT INTO usuarios(id,empleado_id,email,password_hash,rol) VALUES ('019a0000-0002-7000-8000-000000000010','019a0000-0001-7000-8000-000000000010','empleado10@example.test','$argon2id$v=19$m=65536,t=3,p=4$qmgrJLMfoqS8uQ8+CH/xVQ$VfTNo1nIIv3tPM450T0XTlcEA+RGTPPJNZZ9yHABqNQ','EMPLEADO') ON CONFLICT (id) DO NOTHING;

    -- El contexto de auditoría identifica al administrador ficticio que registra el horario.
    PERFORM set_config('app.usuario_id', '019a0000-0002-7000-8000-000000000001', true);
    PERFORM set_config('app.ip', '127.0.0.1', true);

    -- 5. FOTO HISTÓRICA DEL HORARIO. El motor elige la última fecha "desde" aplicable.
    INSERT INTO asistencia_jornada(id,empleado_id,desde,jornada_id,horario,tolerancia_minutos,politica_tolerancia,minutos_semana,motivo,usuario_id) VALUES ('019a0000-0006-7000-8000-000000000001','019a0000-0001-7000-8000-000000000001','2026-09-01','019a0000-0005-7000-8000-000000000001',v_horario_40h,5,'COMPLETA',2400,'Carga de demostración documentada','019a0000-0002-7000-8000-000000000001') ON CONFLICT (id) DO NOTHING;
    INSERT INTO asistencia_jornada(id,empleado_id,desde,jornada_id,horario,tolerancia_minutos,politica_tolerancia,minutos_semana,motivo,usuario_id) VALUES ('019a0000-0006-7000-8000-000000000002','019a0000-0001-7000-8000-000000000002','2026-09-01','019a0000-0005-7000-8000-000000000001',v_horario_40h,5,'COMPLETA',2400,'Carga de demostración documentada','019a0000-0002-7000-8000-000000000001') ON CONFLICT (id) DO NOTHING;
    INSERT INTO asistencia_jornada(id,empleado_id,desde,jornada_id,horario,tolerancia_minutos,politica_tolerancia,minutos_semana,motivo,usuario_id) VALUES ('019a0000-0006-7000-8000-000000000003','019a0000-0001-7000-8000-000000000003','2026-09-01','019a0000-0005-7000-8000-000000000001',v_horario_40h,5,'COMPLETA',2400,'Carga de demostración documentada','019a0000-0002-7000-8000-000000000001') ON CONFLICT (id) DO NOTHING;
    INSERT INTO asistencia_jornada(id,empleado_id,desde,jornada_id,horario,tolerancia_minutos,politica_tolerancia,minutos_semana,motivo,usuario_id) VALUES ('019a0000-0006-7000-8000-000000000004','019a0000-0001-7000-8000-000000000004','2026-09-01','019a0000-0005-7000-8000-000000000001',v_horario_40h,5,'COMPLETA',2400,'Carga de demostración documentada','019a0000-0002-7000-8000-000000000001') ON CONFLICT (id) DO NOTHING;
    INSERT INTO asistencia_jornada(id,empleado_id,desde,jornada_id,horario,tolerancia_minutos,politica_tolerancia,minutos_semana,motivo,usuario_id) VALUES ('019a0000-0006-7000-8000-000000000005','019a0000-0001-7000-8000-000000000005','2026-09-01','019a0000-0005-7000-8000-000000000001',v_horario_40h,5,'COMPLETA',2400,'Carga de demostración documentada','019a0000-0002-7000-8000-000000000001') ON CONFLICT (id) DO NOTHING;
    INSERT INTO asistencia_jornada(id,empleado_id,desde,jornada_id,horario,tolerancia_minutos,politica_tolerancia,minutos_semana,motivo,usuario_id) VALUES ('019a0000-0006-7000-8000-000000000006','019a0000-0001-7000-8000-000000000006','2026-09-01','019a0000-0005-7000-8000-000000000001',v_horario_40h,5,'COMPLETA',2400,'Carga de demostración documentada','019a0000-0002-7000-8000-000000000001') ON CONFLICT (id) DO NOTHING;
    INSERT INTO asistencia_jornada(id,empleado_id,desde,jornada_id,horario,tolerancia_minutos,politica_tolerancia,minutos_semana,motivo,usuario_id) VALUES ('019a0000-0006-7000-8000-000000000007','019a0000-0001-7000-8000-000000000007','2026-09-01','019a0000-0005-7000-8000-000000000001',v_horario_40h,5,'COMPLETA',2400,'Carga de demostración documentada','019a0000-0002-7000-8000-000000000001') ON CONFLICT (id) DO NOTHING;
    INSERT INTO asistencia_jornada(id,empleado_id,desde,jornada_id,horario,tolerancia_minutos,politica_tolerancia,minutos_semana,motivo,usuario_id) VALUES ('019a0000-0006-7000-8000-000000000008','019a0000-0001-7000-8000-000000000008','2026-09-01','019a0000-0005-7000-8000-000000000001',v_horario_40h,5,'COMPLETA',2400,'Carga de demostración documentada','019a0000-0002-7000-8000-000000000001') ON CONFLICT (id) DO NOTHING;
    INSERT INTO asistencia_jornada(id,empleado_id,desde,jornada_id,horario,tolerancia_minutos,politica_tolerancia,minutos_semana,motivo,usuario_id) VALUES ('019a0000-0006-7000-8000-000000000009','019a0000-0001-7000-8000-000000000009','2026-09-01','019a0000-0005-7000-8000-000000000001',v_horario_40h,5,'COMPLETA',2400,'Carga de demostración documentada','019a0000-0002-7000-8000-000000000001') ON CONFLICT (id) DO NOTHING;
    INSERT INTO asistencia_jornada(id,empleado_id,desde,jornada_id,horario,tolerancia_minutos,politica_tolerancia,minutos_semana,motivo,usuario_id) VALUES ('019a0000-0006-7000-8000-000000000010','019a0000-0001-7000-8000-000000000010','2026-09-01','019a0000-0005-7000-8000-000000000001',v_horario_40h,5,'COMPLETA',2400,'Carga de demostración documentada','019a0000-0002-7000-8000-000000000001') ON CONFLICT (id) DO NOTHING;

    -- 6. CONFIGURACIÓN FINANCIERA FICTICIA.
    INSERT INTO dato_financiero(id,empleado_id,id_regimen,id_tipo_afp,sueldo_basico,cuspp,tipo_comision,id_banco_sueldo,nro_cuenta_sueldo,cci_sueldo) VALUES ('019a0000-0007-7000-8000-000000000001','019a0000-0001-7000-8000-000000000001',v_onp_id,NULL,1500,NULL,NULL,v_bcp_id,'19100000000001','00219100000000000001') ON CONFLICT (id) DO NOTHING;
    INSERT INTO dato_financiero(id,empleado_id,id_regimen,id_tipo_afp,sueldo_basico,cuspp,tipo_comision,id_banco_sueldo,nro_cuenta_sueldo,cci_sueldo) VALUES ('019a0000-0007-7000-8000-000000000002','019a0000-0001-7000-8000-000000000002',v_onp_id,NULL,1600,NULL,NULL,v_bcp_id,'19100000000002','00219100000000000002') ON CONFLICT (id) DO NOTHING;
    INSERT INTO dato_financiero(id,empleado_id,id_regimen,id_tipo_afp,sueldo_basico,cuspp,tipo_comision,id_banco_sueldo,nro_cuenta_sueldo,cci_sueldo) VALUES ('019a0000-0007-7000-8000-000000000003','019a0000-0001-7000-8000-000000000003',v_onp_id,NULL,1700,NULL,NULL,v_bcp_id,'19100000000003','00219100000000000003') ON CONFLICT (id) DO NOTHING;
    INSERT INTO dato_financiero(id,empleado_id,id_regimen,id_tipo_afp,sueldo_basico,cuspp,tipo_comision,id_banco_sueldo,nro_cuenta_sueldo,cci_sueldo) VALUES ('019a0000-0007-7000-8000-000000000004','019a0000-0001-7000-8000-000000000004',v_onp_id,NULL,1800,NULL,NULL,v_bcp_id,'19100000000004','00219100000000000004') ON CONFLICT (id) DO NOTHING;
    INSERT INTO dato_financiero(id,empleado_id,id_regimen,id_tipo_afp,sueldo_basico,cuspp,tipo_comision,id_banco_sueldo,nro_cuenta_sueldo,cci_sueldo) VALUES ('019a0000-0007-7000-8000-000000000005','019a0000-0001-7000-8000-000000000005',v_onp_id,NULL,1900,NULL,NULL,v_bcp_id,'19100000000005','00219100000000000005') ON CONFLICT (id) DO NOTHING;
    INSERT INTO dato_financiero(id,empleado_id,id_regimen,id_tipo_afp,sueldo_basico,cuspp,tipo_comision,id_banco_sueldo,nro_cuenta_sueldo,cci_sueldo) VALUES ('019a0000-0007-7000-8000-000000000006','019a0000-0001-7000-8000-000000000006',v_spp_id,v_integra_id,2000,'DEMO00000006','FLUJO',v_bcp_id,'19100000000006','00219100000000000006') ON CONFLICT (id) DO NOTHING;
    INSERT INTO dato_financiero(id,empleado_id,id_regimen,id_tipo_afp,sueldo_basico,cuspp,tipo_comision,id_banco_sueldo,nro_cuenta_sueldo,cci_sueldo) VALUES ('019a0000-0007-7000-8000-000000000007','019a0000-0001-7000-8000-000000000007',v_spp_id,v_integra_id,2100,'DEMO00000007','FLUJO',v_bcp_id,'19100000000007','00219100000000000007') ON CONFLICT (id) DO NOTHING;
    INSERT INTO dato_financiero(id,empleado_id,id_regimen,id_tipo_afp,sueldo_basico,cuspp,tipo_comision,id_banco_sueldo,nro_cuenta_sueldo,cci_sueldo) VALUES ('019a0000-0007-7000-8000-000000000008','019a0000-0001-7000-8000-000000000008',v_spp_id,v_integra_id,2200,'DEMO00000008','FLUJO',v_bcp_id,'19100000000008','00219100000000000008') ON CONFLICT (id) DO NOTHING;
    INSERT INTO dato_financiero(id,empleado_id,id_regimen,id_tipo_afp,sueldo_basico,cuspp,tipo_comision,id_banco_sueldo,nro_cuenta_sueldo,cci_sueldo) VALUES ('019a0000-0007-7000-8000-000000000009','019a0000-0001-7000-8000-000000000009',v_spp_id,v_integra_id,2300,'DEMO00000009','FLUJO',v_bcp_id,'19100000000009','00219100000000000009') ON CONFLICT (id) DO NOTHING;
    INSERT INTO dato_financiero(id,empleado_id,id_regimen,id_tipo_afp,sueldo_basico,cuspp,tipo_comision,id_banco_sueldo,nro_cuenta_sueldo,cci_sueldo) VALUES ('019a0000-0007-7000-8000-000000000010','019a0000-0001-7000-8000-000000000010',v_spp_id,v_integra_id,2400,'DEMO00000010','FLUJO',v_bcp_id,'19100000000010','00219100000000000010') ON CONFLICT (id) DO NOTHING;

    -- 7. TASAS EXCLUSIVAS DE DEMOSTRACIÓN SEPTIEMBRE 2026 (SIN COLISIÓN CON POSTMAN NI SEED).
    IF NOT EXISTS (
        SELECT 1 FROM parametro_legal
        WHERE codigo = 'VIDA_LEY_PCT'
          AND vigente_desde <= '2026-09-30'
          AND COALESCE(vigente_hasta, 'infinity'::date) >= '2026-09-01'
    ) THEN
        INSERT INTO parametro_legal(id,codigo,nombre,valor,vigente_desde,vigente_hasta,descripcion)
        VALUES ('019a0000-0008-7000-8000-000000000001','VIDA_LEY_PCT','DEMO Vida Ley',0.001,'2026-09-01','2026-09-30','Tasa ficticia 0.1%, solo para esta demostración')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM comisiones_afp
        WHERE afp_id = v_integra_id
          AND periodo_inicio <= '2026-09-30'
          AND periodo_final >= '2026-09-01'
    ) THEN
        INSERT INTO comisiones_afp(id,afp_id,aporte_obligatorio,prima_seguro,comision_sobre_ra,comision_mixta,comision_flujo_mixta,remuneracion_maxima_asegurable,periodo_inicio,periodo_final)
        VALUES ('019a0000-0008-7000-8000-000000000002',v_integra_id,10,1.37,1.55,0.78,0,12732.70,'2026-09-01','2026-09-30')
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

COMMIT;