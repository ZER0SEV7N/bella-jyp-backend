-- ====================================================================
-- SISTEMA DE PLANILLAS J&P - POSTGRESQL PRODUCTION BLUEPRINT
-- Arquitectura de Élite: UUIDv7, Precisión NUMERIC(12,4), Inmutabilidad
-- ====================================================================

-- -------------------------------------------------------
-- 1. EXTENSIONES Y TIPOS ENUMERADOS
-- -------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE estado_tarea_enum AS ENUM ('pendiente', 'revision', 'aprobado')[cite: 1];
CREATE TYPE estado_planilla_enum AS ENUM ('abierto', 'en_revision', 'congelado', 'declarado');
CREATE TYPE rol_usuario_enum AS ENUM ('ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE', 'EMPLEADO');

-- -------------------------------------------------------
-- 2. TABLAS CATÁLOGO BASE (Sin dependencias)
-- -------------------------------------------------------

CREATE TABLE area (
    id          UUID            PRIMARY KEY,
    nombre      VARCHAR(100)    NOT NULL[cite: 2],
    descripcion VARCHAR(255)[cite: 2],
    activo      BOOLEAN         NOT NULL DEFAULT TRUE[cite: 2],
    deleted_at  TIMESTAMPTZ     DEFAULT NULL [cite: 2]
);

CREATE TABLE estado_contrato (
    id          UUID            PRIMARY KEY,
    nombre      VARCHAR(100)    NOT NULL [cite: 3]
);

CREATE TABLE estado_empleado (
    id          UUID            PRIMARY KEY,
    descripcion VARCHAR(100)    NOT NULL [cite: 4]
);

CREATE TABLE tipo_documento (
    id              UUID            PRIMARY KEY,
    tipo_documento  VARCHAR(100)    NOT NULL [cite: 5]
);

CREATE TABLE bancos (
    id          UUID            PRIMARY KEY,
    nombre      VARCHAR(100)    NOT NULL [cite: 6]
);

CREATE TABLE regimen_pension (
    id          UUID            PRIMARY KEY,
    nombre      VARCHAR(100)    NOT NULL [cite: 7]
);

-- -------------------------------------------------------
-- 3. DEPENDENCIAS DE PRIMER NIVEL
-- -------------------------------------------------------

CREATE TABLE cargo (
    id          UUID            PRIMARY KEY,
    id_area     UUID            NOT NULL,
    nombre      VARCHAR(100)    NOT NULL[cite: 8],
    descripcion VARCHAR(255)[cite: 8],
    activo      BOOLEAN         NOT NULL DEFAULT TRUE[cite: 8, 9],
    deleted_at  TIMESTAMPTZ     DEFAULT NULL[cite: 9],

    CONSTRAINT fk_cargo_area FOREIGN KEY (id_area) REFERENCES area(id) [cite: 9]
);

CREATE TABLE tipo_AFP (
    id          UUID            PRIMARY KEY,
    id_regimen  UUID            NOT NULL,
    nombre      VARCHAR(100)    NOT NULL[cite: 10],

    CONSTRAINT fk_tipo_afp_regimen FOREIGN KEY (id_regimen) REFERENCES regimen_pension(id) [cite: 10]
);
COMMENT ON TABLE tipo_AFP IS 'Solo aplica si el régimen de pensión es AFP'[cite: 11];

-- -------------------------------------------------------
-- 4. DEPENDENCIAS DE SEGUNDO NIVEL
-- -------------------------------------------------------

CREATE TABLE comisiones_AFP (
    id                  UUID            PRIMARY KEY,
    afp_id              UUID            NOT NULL,
    periodo             VARCHAR(50)     NOT NULL[cite: 12, 13],
    aporte_obligatorio  NUMERIC(6,4)    NOT NULL DEFAULT 0,
    comision_sobre_ra   NUMERIC(6,4)    NOT NULL DEFAULT 0,
    prima_seguro        NUMERIC(6,4)    NOT NULL DEFAULT 0,
    comision_mixta      NUMERIC(6,4)    NOT NULL DEFAULT 0,

    CONSTRAINT fk_comisiones_afp_tipo FOREIGN KEY (afp_id) REFERENCES tipo_AFP(id) [cite: 13]
);

CREATE TABLE aportaciones (
    id          UUID            PRIMARY KEY,
    afp_id      UUID            NOT NULL,
    nombre      VARCHAR(100)    NOT NULL[cite: 14],
    cantidad    NUMERIC(12,4)   NOT NULL DEFAULT 0,

    CONSTRAINT fk_aportaciones_afp FOREIGN KEY (afp_id) REFERENCES tipo_AFP(id) [cite: 14]
);

CREATE TABLE empleados (
    id                  UUID            PRIMARY KEY,
    cargo_id            UUID            NOT NULL,
    area_id             UUID            NOT NULL,
    documento_id        UUID            NOT NULL,
    estado_empleado_id  UUID            NOT NULL,
    nombre              VARCHAR(100)    NOT NULL[cite: 16],
    apellido            VARCHAR(100)    NOT NULL[cite: 16],
    nro_documento       VARCHAR(20)     NOT NULL UNIQUE[cite: 16],
    fecha_nacimiento    DATE[cite: 17],
    fecha_inicio        DATE[cite: 17],
    fecha_cese          DATE[cite: 17],
    afp_fecha_filiacion DATE[cite: 17],
    asig_familiar       BOOLEAN         NOT NULL DEFAULT FALSE[cite: 17],
    activo              BOOLEAN         NOT NULL DEFAULT TRUE[cite: 17],
    deleted_at          TIMESTAMPTZ     DEFAULT NULL[cite: 17, 18],
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()[cite: 18],
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()[cite: 18],

    CONSTRAINT fk_empleados_cargo FOREIGN KEY (cargo_id) REFERENCES cargo(id)[cite: 18],
    CONSTRAINT fk_empleados_area FOREIGN KEY (area_id) REFERENCES area(id)[cite: 18],
    CONSTRAINT fk_empleados_tipo_documento FOREIGN KEY (documento_id) REFERENCES tipo_documento(id)[cite: 18, 19],
    CONSTRAINT fk_empleados_estado FOREIGN KEY (estado_empleado_id) REFERENCES estado_empleado(id) [cite: 19]
);

-- -------------------------------------------------------
-- 5. DEPENDENCIAS FINANCIERAS Y ACCESO (Tercer Nivel)
-- -------------------------------------------------------

CREATE TABLE dato_financiero (
    id                  UUID            PRIMARY KEY,
    empleado_id         UUID            NOT NULL UNIQUE[cite: 20],  
    id_regimen          UUID            NOT NULL,
    id_tipo_AFP         UUID,           
    id_banco            UUID,
    cuenta_bancaria     VARCHAR(30)[cite: 21],
    sueldo_basico       NUMERIC(12,4)   NOT NULL DEFAULT 0,
    cuspp               VARCHAR(20)[cite: 21, 22],
    tipo_comision       VARCHAR(50)[cite: 22],
    nro_cuenta_sueldo   VARCHAR(30)[cite: 22],
    cci                 VARCHAR(30)[cite: 22],
    banco_cts           VARCHAR(50)[cite: 22],
    nro_cuenta_cts      VARCHAR(30)[cite: 22],
    deleted_at          TIMESTAMPTZ     DEFAULT NULL[cite: 22],

    CONSTRAINT fk_dato_financiero_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id)[cite: 22, 23],
    CONSTRAINT fk_dato_financiero_regimen FOREIGN KEY (id_regimen) REFERENCES regimen_pension(id)[cite: 23],
    CONSTRAINT fk_dato_financiero_tipo_afp FOREIGN KEY (id_tipo_AFP) REFERENCES tipo_AFP(id)[cite: 23],
    CONSTRAINT fk_dato_financiero_banco FOREIGN KEY (id_banco) REFERENCES bancos(id) [cite: 23]
);

CREATE TABLE usuarios (
    id              UUID                PRIMARY KEY,
    empleado_id     UUID                NOT NULL UNIQUE[cite: 24],
    email           VARCHAR(150)        NOT NULL UNIQUE[cite: 24],
    password_hash   VARCHAR(255)        NOT NULL[cite: 24],
    rol             rol_usuario_enum    NOT NULL,
    activo          BOOLEAN             NOT NULL DEFAULT TRUE[cite: 24, 25],
    deleted_at      TIMESTAMPTZ         DEFAULT NULL[cite: 25],
    ultimo_acceso   TIMESTAMPTZ[cite: 25],
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()[cite: 25],
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()[cite: 25],

    CONSTRAINT fk_usuarios_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id) [cite: 25]
);

-- -------------------------------------------------------
-- 6. TABLAS TRANSACCIONALES CORE
-- -------------------------------------------------------

CREATE TABLE contratos (
    id              UUID            PRIMARY KEY,
    empleado_id     UUID            NOT NULL,
    id_estado       UUID            NOT NULL,
    tipo_modalidad  VARCHAR(100)[cite: 26],
    fecha_inicio    DATE            NOT NULL[cite: 26, 27],
    fecha_fin       DATE[cite: 27],
    renovado        BOOLEAN         NOT NULL DEFAULT FALSE[cite: 27],
    observacion     TEXT[cite: 27],
    deleted_at      TIMESTAMPTZ     DEFAULT NULL[cite: 27],
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()[cite: 27],

    CONSTRAINT fk_contratos_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id)[cite: 27, 28],
    CONSTRAINT fk_contratos_estado FOREIGN KEY (id_estado) REFERENCES estado_contrato(id) [cite: 28]
);

CREATE TABLE tareas_asistente (
    id              UUID                PRIMARY KEY,
    asignado_a      UUID                NOT NULL,
    asignado_por    UUID                NOT NULL,
    titulo          VARCHAR(200)        NOT NULL[cite: 32, 33],
    descripcion     TEXT[cite: 33],
    fecha_entrega   DATE[cite: 33],
    estado          estado_tarea_enum   NOT NULL DEFAULT 'pendiente'[cite: 33],
    anotaciones     TEXT[cite: 33],
    deleted_at      TIMESTAMPTZ         DEFAULT NULL[cite: 33],
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()[cite: 33],

    CONSTRAINT fk_tareas_asignado_a FOREIGN KEY (asignado_a) REFERENCES usuarios(id)[cite: 33, 34],
    CONSTRAINT fk_tareas_asignado_por FOREIGN KEY (asignado_por) REFERENCES usuarios(id) [cite: 34]
);

CREATE TABLE anotacion_tareas (
    id              UUID            PRIMARY KEY,
    tarea_id        UUID            NOT NULL,
    asignado_por    UUID            NOT NULL,
    descripcion     TEXT            NOT NULL[cite: 35],
    deleted_at      TIMESTAMPTZ     DEFAULT NULL[cite: 35],
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()[cite: 35, 36],

    CONSTRAINT fk_anotacion_tareas_tarea FOREIGN KEY (tarea_id) REFERENCES tareas_asistente(id)[cite: 36],
    CONSTRAINT fk_anotacion_tareas_usuario FOREIGN KEY (asignado_por) REFERENCES usuarios(id) [cite: 36]
);
COMMENT ON TABLE anotacion_tareas IS 'Solo puede ser usada por usuarios con rol Contador'[cite: 37];

-- -------------------------------------------------------
-- 7. TABLAS INMUTABLES (Auditoría y Motor de Nómina)
-- -------------------------------------------------------

CREATE TABLE audit_log (
    id              UUID            PRIMARY KEY,
    usuario_id      UUID,           -- NULL = Ejecutado por n8n o Sistema
    accion          VARCHAR(100)    NOT NULL,
    tabla_afectada  VARCHAR(100)    NOT NULL,
    registro_id     UUID            NOT NULL,
    valores_antes   JSONB           DEFAULT NULL,
    valores_despues JSONB           DEFAULT NULL,
    direccion_ip    INET            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_audit_log_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
COMMENT ON TABLE audit_log IS 'Tabla de auditoría — nunca se elimina lógicamente ni se altera'[cite: 31];

CREATE TABLE historial_planillas (
    id                      UUID                    PRIMARY KEY,
    empleado_id             UUID                    NOT NULL,
    periodo                 VARCHAR(7)              NOT NULL, 
    
    sueldo_base             NUMERIC(12,4)           NOT NULL DEFAULT 0.0000,
    asignacion_familia      NUMERIC(12,4)           NOT NULL DEFAULT 0.0000,
    horas_extras_25         NUMERIC(12,4)           NOT NULL DEFAULT 0.0000,
    horas_extras_35         NUMERIC(12,4)           NOT NULL DEFAULT 0.0000,
    recargo_nocturno        NUMERIC(12,4)           NOT NULL DEFAULT 0.0000,
    
    descuento_afp_fondo     NUMERIC(12,4)           NOT NULL DEFAULT 0.0000,
    descuento_afp_seguro    NUMERIC(12,4)           NOT NULL DEFAULT 0.0000,
    descuento_afp_comision  NUMERIC(12,4)           NOT NULL DEFAULT 0.0000,
    descuento_quinta        NUMERIC(12,4)           NOT NULL DEFAULT 0.0000,
    tasa_afp_aplicada       NUMERIC(6,4)            NOT NULL,
    
    aporte_essalud          NUMERIC(12,4)           NOT NULL DEFAULT 0.0000,
    
    total_ingresos          NUMERIC(12,4)           NOT NULL DEFAULT 0.0000,
    total_descuentos        NUMERIC(12,4)           NOT NULL DEFAULT 0.0000,
    neto_a_pagar            NUMERIC(12,4)           NOT NULL DEFAULT 0.0000,
    
    estado                  estado_planilla_enum    NOT NULL DEFAULT 'abierto',
    comentarios             TEXT,
    activo                  BOOLEAN                 NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ             DEFAULT NULL,
    
    CONSTRAINT fk_historial_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id),
    CONSTRAINT uq_empleado_periodo UNIQUE (empleado_id, periodo)
);

-- -------------------------------------------------------
-- 8. ÍNDICES ESTRATÉGICOS
-- -------------------------------------------------------

CREATE INDEX idx_empleados_area ON empleados(area_id)[cite: 38];
CREATE INDEX idx_empleados_cargo ON empleados(cargo_id)[cite: 39];
CREATE INDEX idx_empleados_activo ON empleados(activo) WHERE activo = TRUE[cite: 40];
CREATE INDEX idx_empleados_deleted ON empleados(deleted_at) WHERE deleted_at IS NULL[cite: 41];

CREATE INDEX idx_contratos_empleado ON contratos(empleado_id)[cite: 41];
CREATE INDEX idx_contratos_deleted ON contratos(deleted_at) WHERE deleted_at IS NULL[cite: 42];

CREATE INDEX idx_usuarios_email ON usuarios(email)[cite: 43];
CREATE INDEX idx_usuarios_empleado ON usuarios(empleado_id)[cite: 43];
CREATE INDEX idx_usuarios_activo ON usuarios(activo) WHERE activo = TRUE[cite: 44];
CREATE INDEX idx_usuarios_deleted ON usuarios(deleted_at) WHERE deleted_at IS NULL[cite: 45];

CREATE INDEX idx_audit_log_usuario ON audit_log(usuario_id)[cite: 46];
CREATE INDEX idx_audit_log_tabla ON audit_log(tabla_afectada)[cite: 46];
CREATE INDEX idx_audit_log_fecha ON audit_log(created_at DESC)[cite: 47];

CREATE INDEX idx_tareas_asignado_a ON tareas_asistente(asignado_a)[cite: 47];
CREATE INDEX idx_tareas_estado ON tareas_asistente(estado)[cite: 48];
CREATE INDEX idx_tareas_deleted ON tareas_asistente(deleted_at) WHERE deleted_at IS NULL[cite: 49];

CREATE INDEX idx_tipo_afp_regimen ON tipo_AFP(id_regimen)[cite: 50];
CREATE INDEX idx_cargo_area ON cargo(id_area)[cite: 50];
CREATE INDEX idx_dato_fin_empleado ON dato_financiero(empleado_id)[cite: 51];

CREATE INDEX idx_planilla_periodo_estado ON historial_planillas (periodo, estado);

-- -------------------------------------------------------
-- 9. FUNCIONES Y DISPARADORES (Triggers)
-- -------------------------------------------------------

-- A) Función Genérica de Soft Delete
CREATE OR REPLACE FUNCTION soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'Borrado físico no permitido en tabla %. Use UPDATE SET deleted_at = NOW()',
        TG_TABLE_NAME[cite: 51, 52];
    RETURN NULL;
END;
$$ LANGUAGE plpgsql[cite: 52];

-- Aplicación del Trigger a tablas con Soft Delete
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'area', 'cargo', 'empleados', 'dato_financiero',
        'usuarios', 'contratos', 'tareas_asistente', 'anotacion_tareas', 'historial_planillas'
    ] [cite: 53, 54]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_no_delete_%I
             BEFORE DELETE ON %I
             FOR EACH ROW EXECUTE FUNCTION soft_delete();',
            t, t [cite: 54, 55]
        );
    END LOOP[cite: 55];
END;
$$[cite: 56];

-- B) Función de Inmutabilidad Contable (Blindaje de Planillas)
CREATE OR REPLACE FUNCTION proteger_planilla_congelada()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.estado = 'congelado' OR OLD.estado = 'declarado') THEN
        RAISE EXCEPTION 'CRITICAL ERROR: El periodo contable % se encuentra CONGELADO/DECLARADO. Operación DML rechazada en base de datos.', OLD.periodo
        USING ERRCODE = 'RESTRICT_VIOLATION';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_proteger_planilla
BEFORE UPDATE OR DELETE ON historial_planillas
FOR EACH ROW EXECUTE FUNCTION proteger_planilla_congelada();

-- C) Función de Inmutabilidad de Auditoría (Blindaje Anti-Sabotaje)
CREATE OR REPLACE FUNCTION denegar_manipulacion_auditoria()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'CRITICAL ERROR: Los registros de la tabla audit_log son INMUTABLES. Intento de sabotaje detectado.'
    USING ERRCODE = 'INSUFFICIENT_PRIVILEGE';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blindar_auditoria
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION denegar_manipulacion_auditoria();