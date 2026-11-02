-- ================================================================================================
-- SISTEMA DE PLANILLAS J&P PERIFÉRICOS SAC — DATOS DE PRUEBA DOCUMENTADOS (UTF-8)
-- ================================================================================================
-- Propósito:
--   Crear una demostración ficticia e idempotente del flujo de asistencia y planilla de
--   septiembre 2026 sin duplicar ni pisar los catálogos que ya siembra `npx prisma db seed`.
--
-- Orden de ejecución tras un DROP DATABASE:
--   1. Crear esquema y protecciones SQL: `pnpm db:crear` (o `npx prisma db push` + `pnpm db:instalar-objetos`)
--   2. Sembrar catálogos oficiales (bancos, documentos, regímenes, AFP, comisiones oct-2026 y parámetros):
--      `npx prisma db seed` (o `pnpm db:seed`)
--   3. Ejecutar este archivo desde VS Code SQLTools (botón "▷ Run"), pgAdmin, DBeaver o `pnpm db:demo`.
--
-- Notas técnicas:
--   - Configura automáticamente `client_encoding = 'UTF8'` y `app.entorno_pruebas = 'SI'` tanto a
--     nivel de sesión como de transacción (`set_config`), evitando el fallo en clientes visuales.
--   - NO vuelve a sembrar bancos, tipos de documento, regímenes, AFP, RMV, UIT, EsSalud, ONP ni
--     las comisiones de octubre 2026 (responsabilidad exclusiva de `prisma/seed.ts`).
-- ================================================================================================

SET client_encoding = 'UTF8';
SET app.entorno_pruebas = 'SI';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Garantiza que la función asistencia_uuid_v7() exista si se recreó el esquema con `prisma db push`
CREATE OR REPLACE FUNCTION asistencia_uuid_v7()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $func$
DECLARE
    milisegundos bigint;
    aleatorio bytea;
    tiempoHex text;
    bytesUuid bytea;
BEGIN
    milisegundos := floor(extract(epoch FROM clock_timestamp()) * 1000);
    aleatorio := gen_random_bytes(10);
    tiempoHex := lpad(to_hex(milisegundos), 12, '0');
    bytesUuid := decode(tiempoHex, 'hex') || aleatorio;
    bytesUuid := set_byte(bytesUuid, 6, (get_byte(bytesUuid, 6) & 15) | 112);
    bytesUuid := set_byte(bytesUuid, 8, (get_byte(bytesUuid, 8) & 63) | 128);
    RETURN encode(bytesUuid, 'hex')::uuid;
END;
$func$;



BEGIN;

DO $$
DECLARE
    -- --------------------------------------------------------------------------------------------
    -- 1. CONFIGURACIÓN E IDENTIFICADORES DE LA DEMOSTRACIÓN
    -- --------------------------------------------------------------------------------------------
    area_id uuid := '019a0100-0000-7000-8000-000000000001';
    cargo_id uuid := '019a0100-0000-7000-8000-000000000002';
    jornada_id uuid := '019a0100-0000-7000-8000-000000000003';
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
    PERFORM set_config('app.entorno_pruebas', 'SI', true);

    IF current_setting('app.entorno_pruebas', true) IS DISTINCT FROM 'SI' THEN
        RAISE EXCEPTION 'Fixture de prueba: habilite app.entorno_pruebas=SI en una base exclusiva de pruebas.';
    END IF;

    -- El primer empleado identifica una demostración ya instalada. Se omite el bloque completo.
    IF EXISTS (
        SELECT 1 FROM empleados
        WHERE id = '019a0100-0000-7000-8000-000000000010'
    ) THEN
        RAISE NOTICE 'La demostración ya está instalada; no se modificó.';
        RETURN;
    END IF;

    -- --------------------------------------------------------------------------------------------
    -- 3. CATÁLOGOS REQUERIDOS (CREADOS PREVIAMENTE POR `prisma db seed`)
    -- --------------------------------------------------------------------------------------------
    -- Se consultan por su nombre/significado, sin volver a sembrar bancos, AFP, RMV ni UIT.
    SELECT id INTO documento_id
    FROM tipo_documento
    WHERE tipo_documento = 'DNI'
    LIMIT 1;

    SELECT id INTO onp_id
    FROM regimen_pension
    WHERE nombre = 'ONP'
    LIMIT 1;

    IF documento_id IS NULL OR onp_id IS NULL THEN
        RAISE EXCEPTION 'Ejecute primero `npx prisma db seed` (o `pnpm db:seed`) para crear los catálogos base (bancos, AFP, parámetros legales y tipos de documento).';
    END IF;

    -- --------------------------------------------------------------------------------------------
    -- 4. ORGANIZACIÓN DE PRUEBA: ÁREA Y CARGO
    -- --------------------------------------------------------------------------------------------
    INSERT INTO area (id, nombre)
    VALUES (area_id, 'DEMO - Oficina')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO cargo (id, id_area, nombre)
    VALUES (cargo_id, area_id, 'DEMO - Analista')
    ON CONFLICT (id) DO NOTHING;

    -- --------------------------------------------------------------------------------------------
    -- 5. CATÁLOGO DE JORNADA: OCHO HORAS EFECTIVAS, DE LUNES A SÁBADO (48 HORAS)
    -- --------------------------------------------------------------------------------------------
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
    VALUES (jornada_id, 'DEMO - Lunes a sábado, 48 horas', 48, horario)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO jornada_area (jornada_id, area_id)
    VALUES (jornada_id, area_id)
    ON CONFLICT (jornada_id, area_id) DO NOTHING;

    -- --------------------------------------------------------------------------------------------
    -- 6. LEGAJO: TRES EMPLEADOS FICTICIOS
    -- --------------------------------------------------------------------------------------------
    indice := 0;
    FOREACH rol IN ARRAY roles_demo LOOP
        empleado_id := ('019a0100-0000-7000-8000-0000000000' || (10 + indice)::text)::uuid;

        INSERT INTO empleados (
            id, cargo_id, area_id, documento_id, jornada_id,
            nombre, apellido, nro_documento, fecha_inicio, email, telefono, sexo, fecha_nacimiento,
            direccion, referencia_direccion, ubigeo, distrito, provincia, departamento
        ) VALUES (
            empleado_id, cargo_id, area_id, documento_id, jornada_id,
            'DEMO', rol, (90000001 + indice)::text, '2026-09-01', lower(rol) || '@demo.invalid', '99900000' || indice::text, 'MASCULINO', '1990-10-25',
            'Calle ficticia 123', 'Dirección exclusiva de prueba', '150101', 'LIMA', 'LIMA', 'LIMA'
        );

        indice := indice + 1;
    END LOOP;

    -- --------------------------------------------------------------------------------------------
    -- 7. AUTENTICACIÓN: UNA CUENTA POR EMPLEADO (Clave pública: DemoPlanillas2026!)
    -- --------------------------------------------------------------------------------------------
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
    -- 11. VIDA LEY DEMO: SOLO SI EL SEEDER NO REGISTRÓ UNA PÓLIZA VÍA SEED_VIDA_LEY_PCT
    -- --------------------------------------------------------------------------------------------
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

COMMIT;