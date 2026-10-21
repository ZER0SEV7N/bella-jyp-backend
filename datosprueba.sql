-- ================================================================================================
-- SISTEMA DE PLANILLAS JYP — DATOS DE PRUEBA DOCUMENTADOS
-- ================================================================================================
-- Propósito: crear una demostración ficticia del flujo de asistencia y planilla de septiembre 2026.
-- Requisitos: ejecutar basededatos.sql y después prisma db seed para obtener los catálogos base.
-- Habilitación en la MISMA sesión SQL: SET app.entorno_pruebas = 'SI';
-- Esta carga se separa de los seeders: contiene personas/usuarios/horarios de DEMOSTRACIÓN.
-- No borra ni trunca tablas. Todos los bloques se confirman juntos al llegar a COMMIT.
--
-- CONTENIDO Y ORDEN DE DEPENDENCIAS
--   1. Configuración de la demostración y variables compartidas.
--   2. Verificación del entorno y detección de una carga anterior.
--   3. Consulta de catálogos ya creados por los seeders: DNI y ONP.
--   4. Área y cargo de demostración.
--   5. Jornada de lunes a sábado: 08:00–17:00, refrigerio 12:00–13:00, 48 horas efectivas.
--   6. Empleados ficticios.
--   7. Usuarios ficticios con roles RRHH, CONTADOR y ASISTENTE.
--   8. Datos financieros ONP de cada empleado.
--   9. Vigencias individuales de jornada y contexto de auditoría.
--  10. Marcaciones de entrada/salida de septiembre en America/Lima.
--  11. Parámetro Vida Ley exclusivamente DEMO, si todavía no existe el código.
--  12. Confirmación, credenciales de demostración y recorrido manual.

BEGIN;

DO $$
DECLARE
    -- --------------------------------------------------------------------------------------------
    -- 1. CONFIGURACIÓN E IDENTIFICADORES DE LA DEMOSTRACIÓN
    -- --------------------------------------------------------------------------------------------
    -- IDs estables: permiten reconocer este conjunto sin depender de IDs aleatorios de catálogos.
    area_id uuid := '019a0100-0000-7000-8000-000000000001';
    cargo_id uuid := '019a0100-0000-7000-8000-000000000002';
    jornada_id uuid := '019a0100-0000-7000-8000-000000000003';
    -- Este orden vincula RRHH/CONTADOR/ASISTENTE con documentos 90000001/2/3 y sufijos 10/11/12.
    roles_demo text[] := ARRAY['RRHH', 'CONTADOR', 'ASISTENTE'];
    empleado_id uuid;
    usuario_id uuid;
    documento_id uuid;
    onp_id uuid;
    horario jsonb;
    rol text;
    indice integer := 0;
    fecha date;
BEGIN
    -- --------------------------------------------------------------------------------------------
    -- 2. VERIFICACIÓN DEL ENTORNO Y REPETICIÓN DE LA CARGA
    -- --------------------------------------------------------------------------------------------
    -- current_setting lee la habilitación de la sesión; no cambia permisos de producción.
    IF current_setting('app.entorno_pruebas', true) IS DISTINCT FROM 'SI' THEN
        RAISE EXCEPTION 'Fixture de prueba: habilite app.entorno_pruebas=SI en una base exclusiva de pruebas.';
    END IF;

    -- El primer empleado identifica una demostración ya instalada. Se omite el bloque completo.
    -- Este control conserva la carga anterior; no reconstruye una demostración editada parcialmente.
    IF EXISTS (
        SELECT 1 FROM empleados
        WHERE id = '019a0100-0000-7000-8000-000000000010'
    ) THEN
        RAISE NOTICE 'La demostración ya está instalada; no se modificó.';
        RETURN;
    END IF;

    -- --------------------------------------------------------------------------------------------
    -- 3. CATÁLOGOS REQUERIDOS: TIPO DE DOCUMENTO Y RÉGIMEN PENSIONARIO
    -- --------------------------------------------------------------------------------------------
    -- Se consultan por su significado, porque los seeders pueden asignar IDs distintos en cada base.
    -- Este archivo no vuelve a sembrar bancos, AFP, RMV ni UIT.
    SELECT id INTO documento_id
    FROM tipo_documento
    WHERE tipo_documento = 'DNI';

    SELECT id INTO onp_id
    FROM regimen_pension
    WHERE nombre = 'ONP'
    LIMIT 1;

    IF documento_id IS NULL OR onp_id IS NULL THEN
        RAISE EXCEPTION 'Ejecute primero prisma db seed para crear los catálogos.';
    END IF;

    -- --------------------------------------------------------------------------------------------
    -- 4. ORGANIZACIÓN DE PRUEBA: ÁREA Y CARGO
    -- --------------------------------------------------------------------------------------------
    -- El cargo pertenece al área creada aquí. Se comparten por los tres empleados ficticios.
    INSERT INTO area (id, nombre)
    VALUES (area_id, 'DEMO - Oficina');

    INSERT INTO cargo (id, id_area, nombre)
    VALUES (cargo_id, area_id, 'DEMO - Analista');

    -- --------------------------------------------------------------------------------------------
    -- 5. CATÁLOGO DE JORNADA: OCHO HORAS EFECTIVAS, DE LUNES A SÁBADO
    -- --------------------------------------------------------------------------------------------
    -- El JSON contiene los siete días exactamente una vez. DOMINGO queda como no laborable.
    -- Nueve horas entre entrada/salida menos una hora de refrigerio = ocho horas efectivas por día.
    SELECT jsonb_agg(
        jsonb_build_object(
            'dia', dia,
            'laborable', dia <> 'DOMINGO',
            'modalidad', 'PRESENCIAL',
            'entrada', '08:00',
            'inicio_descanso', '12:00',
            'fin_descanso', '13:00',
            'salida', '17:00',
            'total_horas', 8
        ) ORDER BY orden
    ) INTO horario
    FROM unnest(ARRAY[
        'DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'
    ]) WITH ORDINALITY AS dias(dia, orden);

    INSERT INTO jornada (id, nombre, total_horas_semana, horario_semanal)
    VALUES (jornada_id, 'DEMO - Lunes a sábado, 48 horas', 48, horario);

    -- --------------------------------------------------------------------------------------------
    -- 6. LEGAJO: TRES EMPLEADOS FICTICIOS
    -- --------------------------------------------------------------------------------------------
    -- Ingresan el 01/09/2026: la demostración no necesita fabricar planillas de meses anteriores.
    -- Los nombres DEMO y el dominio .invalid permiten identificar claramente el conjunto de prueba.
    FOREACH rol IN ARRAY roles_demo LOOP
        empleado_id := ('019a0100-0000-7000-8000-0000000000' || (10 + indice)::text)::uuid;

        INSERT INTO empleados (
            id, cargo_id, area_id, documento_id, jornada_id,
            nombre, apellido, nro_documento, fecha_inicio
        ) VALUES (
            empleado_id, cargo_id, area_id, documento_id, jornada_id,
            'DEMO', rol, (90000001 + indice)::text, '2026-09-01'
        );

        indice := indice + 1;
    END LOOP;

    -- --------------------------------------------------------------------------------------------
    -- 7. AUTENTICACIÓN: UNA CUENTA POR EMPLEADO
    -- --------------------------------------------------------------------------------------------
    -- usuarios.id y empleados.id representan entidades distintas, aunque se vinculen uno a uno.
    -- El hash Argon2 existente corresponde a la contraseña pública DemoPlanillas2026!.
    indice := 0;
    FOREACH rol IN ARRAY roles_demo LOOP
        empleado_id := ('019a0100-0000-7000-8000-0000000000' || (10 + indice)::text)::uuid;
        usuario_id := ('019a0100-0000-7000-8000-0000000000' || (20 + indice)::text)::uuid;

        INSERT INTO usuarios (id, empleado_id, email, password_hash, rol)
        VALUES (
            usuario_id,
            empleado_id,
            lower(rol) || '@demo.invalid',
            '$argon2id$v=19$m=65536,t=3,p=4$cjjyqWmM/JP6RuxgsOuCkg$4sbNNyU65nGiOsQ09aklpubeEflNzxGIJO3zDBa7Eh8',
            rol::rol_usuario_enum
        );

        indice := indice + 1;
    END LOOP;

    -- --------------------------------------------------------------------------------------------
    -- 8. DATOS FINANCIEROS: SUELDO FICTICIO Y ONP
    -- --------------------------------------------------------------------------------------------
    -- S/3000 es el sueldo de esta demostración, no un parámetro legal ni una remuneración universal.
    -- No se inventan cuentas bancarias; las demás columnas conservan sus valores por defecto.
    indice := 0;
    FOREACH rol IN ARRAY roles_demo LOOP
        empleado_id := ('019a0100-0000-7000-8000-0000000000' || (10 + indice)::text)::uuid;

        INSERT INTO dato_financiero (id, empleado_id, id_regimen, sueldo_basico)
        VALUES (asistencia_uuid_v7(), empleado_id, onp_id, 3000);

        indice := indice + 1;
    END LOOP;

    -- --------------------------------------------------------------------------------------------
    -- 9. ASISTENCIA: COPIA HISTÓRICA DEL HORARIO ASIGNADO
    -- --------------------------------------------------------------------------------------------
    -- Cada persona recibe la misma programación desde su ingreso; 2880 minutos = 48 horas semanales.
    -- app.usuario_id/app.ip se limitan a esta transacción por el tercer argumento true de set_config.
    -- El actor de cada fila coincide con su usuario DEMO para conservar la evidencia de este conjunto.
    indice := 0;
    FOREACH rol IN ARRAY roles_demo LOOP
        empleado_id := ('019a0100-0000-7000-8000-0000000000' || (10 + indice)::text)::uuid;
        usuario_id := ('019a0100-0000-7000-8000-0000000000' || (20 + indice)::text)::uuid;
        PERFORM set_config('app.usuario_id', usuario_id::text, true);
        PERFORM set_config('app.ip', '127.0.0.1', true);

        INSERT INTO asistencia_jornada (
            id, empleado_id, jornada_id, desde, horario,
            tolerancia_minutos, minutos_semana, motivo, usuario_id
        ) VALUES (
            asistencia_uuid_v7(), empleado_id, jornada_id, '2026-09-01', horario,
            5, 2880, 'Asignación ficticia para validar el flujo de planilla.', usuario_id
        );

        indice := indice + 1;
    END LOOP;

    -- --------------------------------------------------------------------------------------------
    -- 10. MARCACIONES: ENTRADAS Y SALIDAS DE SEPTIEMBRE DE 2026
    -- --------------------------------------------------------------------------------------------
    -- generate_series recorre fechas civiles. Se omiten domingos; cada otro día tiene dos marcas.
    -- AT TIME ZONE convierte las 08:00/17:00 de Lima a instantes TIMESTAMPTZ sin depender del servidor.
    -- Se generan 26 días × 2 marcas × 3 empleados = 156 marcas ficticias.
    -- Método MANUAL: este bloque prueba el cálculo; no representa un archivo importado del biométrico.
    indice := 0;
    FOREACH rol IN ARRAY roles_demo LOOP
        empleado_id := ('019a0100-0000-7000-8000-0000000000' || (10 + indice)::text)::uuid;
        usuario_id := ('019a0100-0000-7000-8000-0000000000' || (20 + indice)::text)::uuid;
        PERFORM set_config('app.usuario_id', usuario_id::text, true);
        PERFORM set_config('app.ip', '127.0.0.1', true);

        FOR fecha IN
            SELECT generate_series('2026-09-01'::date, '2026-09-30'::date, '1 day'::interval)::date
        LOOP
            IF extract(dow FROM fecha) <> 0 THEN
                INSERT INTO asistencia_marcacion (
                    id, empleado_id, fecha_hora, tipo_marcacion, metodo, usuario_id, motivo
                ) VALUES (
                    asistencia_uuid_v7(), empleado_id,
                    (fecha + time '08:00') AT TIME ZONE 'America/Lima',
                    'ENTRADA', 'MANUAL', usuario_id, 'Marca sintética de prueba'
                );

                INSERT INTO asistencia_marcacion (
                    id, empleado_id, fecha_hora, tipo_marcacion, metodo, usuario_id, motivo
                ) VALUES (
                    asistencia_uuid_v7(), empleado_id,
                    (fecha + time '17:00') AT TIME ZONE 'America/Lima',
                    'SALIDA', 'MANUAL', usuario_id, 'Marca sintética de prueba'
                );
            END IF;
        END LOOP;

        indice := indice + 1;
    END LOOP;

    -- --------------------------------------------------------------------------------------------
    -- 11. VIDA LEY DEMO: DATO FICTICIO, SEPARADO DE LA CONFIGURACIÓN LEGAL REAL
    -- --------------------------------------------------------------------------------------------
    -- Sólo se añade si no existe ninguna fila del código. No sustituye la configuración ya cargada.
    -- 0.001 es una fracción de prueba: no se propone como prima de una póliza de producción.
    IF NOT EXISTS (SELECT 1 FROM parametro_legal WHERE codigo = 'VIDA_LEY_PCT') THEN
        INSERT INTO parametro_legal (
            id, codigo, nombre, valor, vigente_desde, vigente_hasta, descripcion
        ) VALUES (
            asistencia_uuid_v7(), 'VIDA_LEY_PCT', 'DEMO - Prima ficticia', 0.001,
            '2026-01-01', '2026-12-31',
            'SOLO PRUEBAS: no usar como tarifa de una póliza real.'
        );
    END IF;
END $$;

-- ================================================================================================
-- 12. CONFIRMACIÓN Y USO DE LA DEMOSTRACIÓN
-- ================================================================================================
COMMIT;

-- RESUMEN ESPERADO DE LOS REGISTROS AÑADIDOS
-- Área: 1. Cargo: 1. Jornada catálogo: 1.
-- Empleados: 3. Usuarios: 3. Datos financieros: 3. Asignaciones históricas: 3. Marcaciones: 156.
-- Vida Ley: 0 o 1 filas nuevas según la configuración previa. Los triggers añaden su auditoría.
-- No se insertan solicitudes, incidencias aprobadas ni planillas calculadas: se generan desde la API.
--
-- ACCESO DE PRUEBA (contraseña pública: DemoPlanillas2026!)
-- RRHH:      DNI 90000001 / rrhh@demo.invalid
-- CONTADOR:  DNI 90000002 / contador@demo.invalid
-- ASISTENTE: DNI 90000003 / asistente@demo.invalid
--
-- RECORRIDO MANUAL
-- 1. Autenticarse mediante POST /api/v1/auth/login.
-- 2. Generar el resumen de incidencias para 2026-09 y revisar su detalle diario.
-- 3. Aprobar la asistencia con RRHH.
-- 4. Solicitar la generación de planillas y consultar el trabajo de la cola hasta su finalización.
-- 5. Revisar, congelar como CONTADOR y descargar la boleta del cálculo congelado.