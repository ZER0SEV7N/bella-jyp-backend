-- ================================================================================================
-- SISTEMA DE PLANILLAS J&P PERIFÉRICOS SAC — DATOS DE PRUEBA POSTMAN (3 EMPLEADOS, UTF-8)
-- ================================================================================================
-- Propósito:
--   Crear la demostración ficticia e idempotente para pruebas manuales con Postman (3 empleados:
--   RRHH, CONTADOR y ASISTENTE con marcaciones completas de septiembre 2026) sin duplicar ni pisar
--   los catálogos que ya siembra `npx prisma db seed`, y SIN colisionar con el fixture de 10
--   empleados de n8n (`scripts/pruebas-demo/datosprueba.sql`).
--
-- Compatibilidad con VS Code SQLTools ("▷ Run"), pgAdmin, DBeaver y CLI (`pnpm db:demo`):
--   - No declara funciones de nivel superior (`CREATE FUNCTION ... AS $func$`) que rompen el
--     separador de sentencias de SQLTools (`TypeError: Cannot read properties of null (reading 'name')`).
--   - Todas las variables locales PL/pgSQL usan el prefijo `v_` (`v_jornada_id`, `v_area_id`, etc.)
--     para evitar la colisión con nombres de columnas SQL (`column reference "jornada_id" is ambiguous`).
--   - Utiliza el espacio de UUIDs `019a0100-...`, completamente disjunto del espacio `019a0000-...`
--     usado por el fixture de n8n.
--
-- Credenciales de acceso para Postman:
--   - rrhh@demo.invalid      / DemoPlanillas2026!
--   - contador@demo.invalid  / DemoPlanillas2026!
--   - asistente@demo.invalid / DemoPlanillas2026!
-- ================================================================================================

SET client_encoding = 'UTF8';

SET app.entorno_pruebas = 'SI';

BEGIN;

DO $$
DECLARE
    -- --------------------------------------------------------------------------------------------
    -- 1. CONFIGURACIÓN E IDENTIFICADORES DE LA DEMOSTRACIÓN POSTMAN (PREFIJO v_ SIN AMBIGÜEDAD)
    -- --------------------------------------------------------------------------------------------
    v_area_id uuid := '019a0100-0000-7000-8000-000000000001';
    v_cargo_id uuid := '019a0100-0000-7000-8000-000000000002';
    v_jornada_id uuid := '019a0100-0000-7000-8000-000000000003';
    v_roles_demo text[] := ARRAY['RRHH', 'CONTADOR', 'ASISTENTE'];
    v_empleado_id uuid;
    v_usuario_id uuid;
    v_dato_financiero_id uuid;
    v_asistencia_jornada_id uuid;
    v_documento_id uuid;
    v_onp_id uuid;
    v_integra_id uuid;
    v_horario jsonb;
    v_rol text;
    v_indice integer := 0;
    v_seq integer := 0;
    v_fecha date;
BEGIN
    -- --------------------------------------------------------------------------------------------
    -- 2. VERIFICACIÓN DEL ENTORNO Y REPETICIÓN DE LA CARGA
    -- --------------------------------------------------------------------------------------------
    PERFORM set_config('app.entorno_pruebas', 'SI', true);

    IF current_setting('app.entorno_pruebas', true) IS DISTINCT FROM 'SI' THEN
        RAISE EXCEPTION 'Fixture de prueba: habilite app.entorno_pruebas=SI en una base exclusiva de pruebas.';
    END IF;

    -- El primer empleado Postman (019a0100-...0010) identifica esta demostración ya instalada.
    -- No bloquea ni interfiere con los empleados de n8n (019a0000-0001-...).
    IF EXISTS (
        SELECT 1 FROM empleados
        WHERE id = '019a0100-0000-7000-8000-000000000010'
    ) THEN
        RAISE NOTICE 'La demostración Postman (3 empleados) ya está instalada; no se modificó.';
        RETURN;
    END IF;

    -- --------------------------------------------------------------------------------------------
    -- 3. CATÁLOGOS REQUERIDOS (CREADOS PREVIAMENTE POR `npx prisma db seed`)
    -- --------------------------------------------------------------------------------------------
    SELECT id INTO v_documento_id
    FROM tipo_documento
    WHERE tipo_documento = 'DNI'
    LIMIT 1;

    SELECT id INTO v_onp_id
    FROM regimen_pension
    WHERE nombre = 'ONP'
    LIMIT 1;

    SELECT id INTO v_integra_id
    FROM tipo_afp
    WHERE nombre = 'INTEGRA'
    LIMIT 1;

    IF v_documento_id IS NULL OR v_onp_id IS NULL THEN
        RAISE EXCEPTION 'Ejecute primero `npx prisma db seed` (o `pnpm db:seed`) para crear los catálogos base (bancos, AFP, parámetros legales y tipos de documento).';
    END IF;

    -- --------------------------------------------------------------------------------------------
    -- 4. ORGANIZACIÓN DE PRUEBA: ÁREA Y CARGO
    -- --------------------------------------------------------------------------------------------
    INSERT INTO area (id, nombre)
    VALUES (v_area_id, 'DEMO - Oficina')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO cargo (id, id_area, nombre)
    VALUES (v_cargo_id, v_area_id, 'DEMO - Analista')
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
    ) INTO v_horario
    FROM unnest(ARRAY[
        'DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'
    ]) WITH ORDINALITY AS dias(dia, orden);

    INSERT INTO jornada (id, nombre, total_horas_semana, horario_semanal)
    VALUES (v_jornada_id, 'DEMO - Lunes a sábado, 48 horas', 48, v_horario)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO jornada_area (jornada_id, area_id)
    VALUES (v_jornada_id, v_area_id)
    ON CONFLICT ON CONSTRAINT jornada_area_pkey DO NOTHING;

    -- --------------------------------------------------------------------------------------------
    -- 6. LEGAJO: TRES EMPLEADOS FICTICIOS (DNIs 90000001..90000003)
    -- --------------------------------------------------------------------------------------------
    v_indice := 0;
    FOREACH v_rol IN ARRAY v_roles_demo LOOP
        v_empleado_id := ('019a0100-0000-7000-8000-0000000000' || (10 + v_indice)::text)::uuid;

        INSERT INTO empleados (
            id, cargo_id, area_id, documento_id, jornada_id,
            nombre, apellido, nro_documento, fecha_inicio, email, telefono, sexo, fecha_nacimiento,
            direccion, referencia_direccion, ubigeo, distrito, provincia, departamento
        ) VALUES (
            v_empleado_id, v_cargo_id, v_area_id, v_documento_id, v_jornada_id,
            'DEMO', v_rol, (90000001 + v_indice)::text, '2026-09-01', lower(v_rol) || '@demo.invalid', '99900000' || v_indice::text, 'MASCULINO', '1990-10-25',
            'Calle ficticia 123', 'Dirección exclusiva de prueba', '150101', 'LIMA', 'LIMA', 'LIMA'
        )
        ON CONFLICT (id) DO NOTHING;

        v_indice := v_indice + 1;
    END LOOP;

    -- --------------------------------------------------------------------------------------------
    -- 7. AUTENTICACIÓN: UNA CUENTA POR EMPLEADO (Clave pública: DemoPlanillas2026!)
    -- --------------------------------------------------------------------------------------------
    v_indice := 0;
    FOREACH v_rol IN ARRAY v_roles_demo LOOP
        v_empleado_id := ('019a0100-0000-7000-8000-0000000000' || (10 + v_indice)::text)::uuid;
        v_usuario_id := ('019a0100-0000-7000-8000-0000000000' || (20 + v_indice)::text)::uuid;

        INSERT INTO usuarios (id, empleado_id, email, password_hash, rol)
        VALUES (
            v_usuario_id,
            v_empleado_id,
            lower(v_rol) || '@demo.invalid',
            '$argon2id$v=19$m=65536,t=3,p=4$cjjyqWmM/JP6RuxgsOuCkg$4sbNNyU65nGiOsQ09aklpubeEflNzxGIJO3zDBa7Eh8',
            v_rol::rol_usuario_enum
        )
        ON CONFLICT (id) DO NOTHING;

        v_indice := v_indice + 1;
    END LOOP;

    -- --------------------------------------------------------------------------------------------
    -- 8. DATOS FINANCIEROS: SUELDO FICTICIO Y ONP
    -- --------------------------------------------------------------------------------------------
    v_indice := 0;
    FOREACH v_rol IN ARRAY v_roles_demo LOOP
        v_empleado_id := ('019a0100-0000-7000-8000-0000000000' || (10 + v_indice)::text)::uuid;
        v_dato_financiero_id := ('019a0100-0000-7000-8000-0000000000' || (30 + v_indice)::text)::uuid;

        INSERT INTO dato_financiero (id, empleado_id, id_regimen, sueldo_basico)
        VALUES (v_dato_financiero_id, v_empleado_id, v_onp_id, 3000)
        ON CONFLICT (id) DO NOTHING;

        v_indice := v_indice + 1;
    END LOOP;

    -- --------------------------------------------------------------------------------------------
    -- 9. ASISTENCIA: COPIA HISTÓRICA DEL HORARIO ASIGNADO
    -- --------------------------------------------------------------------------------------------
    v_indice := 0;
    FOREACH v_rol IN ARRAY v_roles_demo LOOP
        v_empleado_id := ('019a0100-0000-7000-8000-0000000000' || (10 + v_indice)::text)::uuid;
        v_usuario_id := ('019a0100-0000-7000-8000-0000000000' || (20 + v_indice)::text)::uuid;
        v_asistencia_jornada_id := ('019a0100-0000-7000-8000-0000000000' || (40 + v_indice)::text)::uuid;
        PERFORM set_config('app.usuario_id', v_usuario_id::text, true);
        PERFORM set_config('app.ip', '127.0.0.1', true);

        INSERT INTO asistencia_jornada (
            id, empleado_id, jornada_id, desde, horario,
            tolerancia_minutos, minutos_semana, motivo, usuario_id
        ) VALUES (
            v_asistencia_jornada_id, v_empleado_id, v_jornada_id, '2026-09-01', v_horario,
            5, 2880, 'Asignación ficticia para validar el flujo de planilla.', v_usuario_id
        )
        ON CONFLICT (id) DO NOTHING;

        v_indice := v_indice + 1;
    END LOOP;

    -- --------------------------------------------------------------------------------------------
    -- 10. MARCACIONES: ENTRADAS Y SALIDAS DE SEPTIEMBRE DE 2026
    -- --------------------------------------------------------------------------------------------
    v_indice := 0;
    v_seq := 1;
    FOREACH v_rol IN ARRAY v_roles_demo LOOP
        v_empleado_id := ('019a0100-0000-7000-8000-0000000000' || (10 + v_indice)::text)::uuid;
        v_usuario_id := ('019a0100-0000-7000-8000-0000000000' || (20 + v_indice)::text)::uuid;
        PERFORM set_config('app.usuario_id', v_usuario_id::text, true);
        PERFORM set_config('app.ip', '127.0.0.1', true);

        FOR v_fecha IN
            SELECT generate_series('2026-09-01'::date, '2026-09-30'::date, '1 day'::interval)::date
        LOOP
            IF extract(dow FROM v_fecha) <> 0 THEN
                INSERT INTO asistencia_marcacion (
                    id, empleado_id, fecha_hora, tipo_marcacion, metodo, usuario_id, motivo
                ) VALUES (
                    ('019a0100-0001-7000-8000-' || lpad(v_seq::text, 12, '0'))::uuid,
                    v_empleado_id,
                    (v_fecha + time '08:00') AT TIME ZONE 'America/Lima',
                    'ENTRADA', 'MANUAL', v_usuario_id, 'Marca sintética de prueba'
                )
                ON CONFLICT (id) DO NOTHING;
                v_seq := v_seq + 1;

                INSERT INTO asistencia_marcacion (
                    id, empleado_id, fecha_hora, tipo_marcacion, metodo, usuario_id, motivo
                ) VALUES (
                    ('019a0100-0001-7000-8000-' || lpad(v_seq::text, 12, '0'))::uuid,
                    v_empleado_id,
                    (v_fecha + time '17:00') AT TIME ZONE 'America/Lima',
                    'SALIDA', 'MANUAL', v_usuario_id, 'Marca sintética de prueba'
                )
                ON CONFLICT (id) DO NOTHING;
                v_seq := v_seq + 1;
            END IF;
        END LOOP;

        v_indice := v_indice + 1;
    END LOOP;

    -- --------------------------------------------------------------------------------------------
    -- 11. TASAS DEMO SEPTIEMBRE 2026: COMPARTIDAS SIN COLISIÓN CON EL FIXTURE DE N8N
    -- --------------------------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM parametro_legal
        WHERE codigo = 'VIDA_LEY_PCT'
          AND vigente_desde <= '2026-09-30'
          AND COALESCE(vigente_hasta, 'infinity'::date) >= '2026-09-01'
    ) THEN
        INSERT INTO parametro_legal (
            id, codigo, nombre, valor, vigente_desde, vigente_hasta, descripcion
        ) VALUES (
            '019a0000-0008-7000-8000-000000000001', 'VIDA_LEY_PCT', 'DEMO Vida Ley', 0.001,
            '2026-09-01', '2026-09-30',
            'Tasa ficticia 0.1%, solo para demostración septiembre 2026'
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;

    IF v_integra_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM comisiones_afp
        WHERE afp_id = v_integra_id
          AND periodo_inicio <= '2026-09-30'
          AND periodo_final >= '2026-09-01'
    ) THEN
        INSERT INTO comisiones_afp (
            id, afp_id, aporte_obligatorio, prima_seguro, comision_sobre_ra,
            comision_mixta, comision_flujo_mixta, remuneracion_maxima_asegurable,
            periodo_inicio, periodo_final
        ) VALUES (
            '019a0000-0008-7000-8000-000000000002', v_integra_id,
            10, 1.37, 1.55, 0.78, 0, 12732.70,
            '2026-09-01', '2026-09-30'
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

COMMIT;