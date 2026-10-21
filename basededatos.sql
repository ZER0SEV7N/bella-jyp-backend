-- ================================================================================================
-- SISTEMA DE PLANILLAS JYP — BASE DE DATOS DOCUMENTADA
-- ================================================================================================
-- Propósito: instalar una base NUEVA y VACÍA con el esquema de Prisma y sus protecciones SQL.
-- Los catálogos se cargan con prisma db seed; las personas ficticias se cargan aparte con
-- datosprueba.sql.
-- Generación: python scripts/construir-sql.py. Editar schema.prisma para la estructura,
-- documentacion_sql.py para las descripciones y los SQL de protecciones para sus reglas.
-- Lectura: secciones 1–11 definen tipos y tablas por módulo, con índices junto a cada tabla. La
-- sección 12 instala relaciones; 13 funciones, 14 triggers, 15 restricciones adicionales y 16
-- versión de instalación.
-- Convenciones: UUID identifica registros; TIMESTAMPTZ conserva instantes con zona; DATE
-- representa fechas civiles. Los importes y tasas mantienen la precisión definida por cada
-- columna. La actualización de updated_at mediante @updatedAt corresponde al ORM, salvo un
-- trigger explícito.
-- Ejecución: una transacción completa. Si una sentencia falla, se debe revertir la transacción;
-- la base no queda confirmada parcialmente. Este archivo no es un incremento para una base ya
-- poblada.

BEGIN;

-- ================================================================================================
-- 1. ESQUEMA PÚBLICO Y TIPOS ENUMERADOS
-- ================================================================================================

CREATE SCHEMA IF NOT EXISTS "public";

-- ------------------------------------------------------------------------------------------------
-- 1.1. duracion_jornada_enum
-- Clasificación contractual de duración: tiempo completo o parcial.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "duracion_jornada_enum" AS ENUM ('TIEMPO_COMPLETO', 'TIEMPO_PARCIAL');

-- ------------------------------------------------------------------------------------------------
-- 1.2. turno_jornada_enum
-- Turno declarado en el catálogo; su existencia no habilita todos los turnos en el motor
-- mensual.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "turno_jornada_enum" AS ENUM ('MANANA', 'TARDE', 'NOCHE', 'MIXTO', 'ROTATIVO');

-- ------------------------------------------------------------------------------------------------
-- 1.3. modalidad_jornada_enum
-- Modalidad del trabajo: presencial, remota o híbrida.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "modalidad_jornada_enum" AS ENUM ('PRESENCIAL', 'REMOTO', 'HIBRIDO');

-- ------------------------------------------------------------------------------------------------
-- 1.4. estado_planilla_enum
-- Estado de la planilla; las transiciones se controlan con casos de uso y triggers.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "estado_planilla_enum" AS ENUM ('ABIERTO', 'EN_REVISION', 'CONGELADO', 'DECLARADO');

-- ------------------------------------------------------------------------------------------------
-- 1.5. estado_tarea_enum
-- Etapas de las tareas operativas del asistente.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "estado_tarea_enum" AS ENUM ('PENDIENTE', 'REVISION', 'APROBADO', 'RECHAZADO', 'AUDITADO');

-- ------------------------------------------------------------------------------------------------
-- 1.6. rol_usuario_enum
-- Roles disponibles; los permisos concretos se comprueban en los guards.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "rol_usuario_enum" AS ENUM ('ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE', 'EMPLEADO', 'JYP');

-- ------------------------------------------------------------------------------------------------
-- 1.7. estado_job_enum
-- Estado persistido de las cargas masivas de personal.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "estado_job_enum" AS ENUM ('EN_COLA', 'PROCESANDO', 'COMPLETADO', 'FALLIDO');

-- ------------------------------------------------------------------------------------------------
-- 1.8. estado_sincronizacion_enum
-- Identifica registros completos o todavía en borrador.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "estado_sincronizacion_enum" AS ENUM ('COMPLETO', 'BORRADOR');

-- ------------------------------------------------------------------------------------------------
-- 1.9. tipo_marcacion_enum
-- Eventos del reloj, incluidos salida y retorno de refrigerio.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "tipo_marcacion_enum" AS ENUM ('ENTRADA', 'SALIDA', 'SALIDA_ALMUERZO', 'ENTRADA_ALMUERZO');

-- ------------------------------------------------------------------------------------------------
-- 1.10. estado_incidencia_enum
-- Dictamen del resumen mensual: pendiente, aprobado o rechazado.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "estado_incidencia_enum" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- ------------------------------------------------------------------------------------------------
-- 1.11. TipoSolicitud
-- Clases de trámite disponibles en solicitudes de RRHH.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "TipoSolicitud" AS ENUM ('VACACIONES', 'LICENCIA_MEDICA', 'PERMISO', 'JUSTIFICACION_ASISTENCIA', 'ACTUALIZACION_DATOS', 'ADELANTO_SUELDO', 'RENUNCIA');

-- ------------------------------------------------------------------------------------------------
-- 1.12. EstadoSolicitud
-- Flujo de revisión de solicitudes y estados finales.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'ANULADA');

-- ------------------------------------------------------------------------------------------------
-- 1.13. tipo_cuenta_bancaria_enum
-- Clase declarada de cuenta sueldo o CTS.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "tipo_cuenta_bancaria_enum" AS ENUM ('SUELDO', 'AHORROS', 'CORRIENTE');

-- ------------------------------------------------------------------------------------------------
-- 1.14. regimen_salud_enum
-- Régimen de salud; algunos valores requieren motores aún no habilitados.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "regimen_salud_enum" AS ENUM ('ESSALUD_REGULAR', 'EPS', 'ESSALUD_Y_EPS', 'SCTR');

-- ------------------------------------------------------------------------------------------------
-- 1.15. vinculo_familiar_enum
-- Relación del derechohabiente con el empleado.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "vinculo_familiar_enum" AS ENUM ('CONYUGE', 'CONCUBINO', 'HIJO_MENOR', 'HIJO_MAYOR_INCAPACITADO', 'HIJO_MAYOR_ESTUDIANTE', 'MADRE_GESTANTE');

-- ------------------------------------------------------------------------------------------------
-- 1.16. estado_civil_enum
-- Valores de estado civil del legajo.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "estado_civil_enum" AS ENUM ('SOLTERO', 'CASADO', 'CONVIVIENTE', 'DIVORCIADO', 'VIUDO');

-- ------------------------------------------------------------------------------------------------
-- 1.17. sexo_enum
-- Valores de identificación previstos en el modelo.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "sexo_enum" AS ENUM ('MASCULINO', 'FEMENINO');

-- ------------------------------------------------------------------------------------------------
-- 1.18. tipo_sustento_familiar_enum
-- Tipo del documento que sustenta el vínculo familiar.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "tipo_sustento_familiar_enum" AS ENUM ('PARTIDA_NACIMIENTO', 'PARTIDA_MATRIMONIO', 'ESCRITURA_CONCUBINATO', 'DNI_DERECHOHABIENTE', 'CONSTANCIA_ESTUDIOS', 'CERTIFICADO_INCAPACIDAD', 'OTRO');

-- ------------------------------------------------------------------------------------------------
-- 1.19. estado_empleado_enum
-- Situación laboral registrada del colaborador.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "estado_empleado_enum" AS ENUM ('ACTIVO', 'VACACIONES', 'LICENCIA', 'CESADO', 'DESPEDIDO', 'SUSPENDIDO');

-- ------------------------------------------------------------------------------------------------
-- 1.20. estado_periodo_vacacional_enum
-- Estados previstos de adquisición y liquidación del período vacacional.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "estado_periodo_vacacional_enum" AS ENUM ('EN_FORMACION', 'ADQUIRIDO', 'LIQUIDADO');

-- ------------------------------------------------------------------------------------------------
-- 1.21. tipo_vacacion_enum
-- Distingue goce y adelanto en el modelo vacacional previsto.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "tipo_vacacion_enum" AS ENUM ('GOCE', 'ADELANTO');

-- ------------------------------------------------------------------------------------------------
-- 1.22. estado_vacacion_enum
-- Etapas previstas de programación y disfrute de vacaciones.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "estado_vacacion_enum" AS ENUM ('PROGRAMADA', 'EN_GOCE', 'GOZADA', 'ANULADA');

-- ------------------------------------------------------------------------------------------------
-- 1.23. naturaleza_concepto_enum
-- Clasifica conceptos como ingreso, descuento o aporte del empleador.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "naturaleza_concepto_enum" AS ENUM ('INGRESO', 'DESCUENTO', 'APORTE_EMPLEADOR');

-- ------------------------------------------------------------------------------------------------
-- 1.24. estado_contrato_enum
-- Estado principal del contrato; convive con el catálogo heredado por compatibilidad.
-- ------------------------------------------------------------------------------------------------

CREATE TYPE "estado_contrato_enum" AS ENUM ('VIGENTE', 'RENOVADO', 'VENCIDO', 'ANULADO', 'FINALIZADO');

-- ================================================================================================
-- 2. CATÁLOGOS BASE
-- ================================================================================================

-- ------------------------------------------------------------------------------------------------
-- 2.1. tipo_documento — Tipos de documento de identidad
-- Catálogo compartido por empleados y derechohabientes; por ejemplo, DNI, CE o pasaporte.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "tipo_documento" (
    "id" UUID NOT NULL,
    "tipo_documento" VARCHAR(100) NOT NULL,
    CONSTRAINT "tipo_documento_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "tipo_documento" IS 'Catálogo compartido por empleados y derechohabientes; por ejemplo, DNI, CE o pasaporte.';

-- Índices de tipo_documento. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (tipo_documento): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "tipo_documento_tipo_documento_key" ON "tipo_documento" ("tipo_documento");

-- ------------------------------------------------------------------------------------------------
-- 2.2. bancos — Entidades bancarias
-- Catálogo referenciado por las cuentas de sueldo y CTS. Los números de cuenta pertenecen al
-- dato financiero.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "bancos" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    CONSTRAINT "bancos_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "bancos" IS 'Catálogo referenciado por las cuentas de sueldo y CTS. Los números de cuenta pertenecen al dato financiero.';

-- ------------------------------------------------------------------------------------------------
-- 2.3. regimen_pension — Regímenes pensionarios
-- Catálogo que identifica ONP o SPP para seleccionar la regla previsional del cálculo.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "regimen_pension" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    CONSTRAINT "regimen_pension_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "regimen_pension" IS 'Catálogo que identifica ONP o SPP para seleccionar la regla previsional del cálculo.';

-- ------------------------------------------------------------------------------------------------
-- 2.4. estado_contrato — Estados de contrato heredados
-- Catálogo de compatibilidad conservado para referencias anteriores. El estado principal de
-- contratos utiliza el enum estado_contrato_enum.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "estado_contrato" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    CONSTRAINT "estado_contrato_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "estado_contrato" IS 'Catálogo de compatibilidad conservado para referencias anteriores. El estado principal de contratos utiliza el enum estado_contrato_enum.';

-- ================================================================================================
-- 3. ORGANIZACIÓN Y HORARIOS
-- ================================================================================================

-- ------------------------------------------------------------------------------------------------
-- 3.1. area — Áreas organizacionales
-- Agrupa cargos y colaboradores; permite filtrar consultas y procesamiento de planillas por
-- área.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "area" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "area_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "area" IS 'Agrupa cargos y colaboradores; permite filtrar consultas y procesamiento de planillas por área.';

-- Índices de area. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (nombre).

CREATE INDEX "idx_area_nombre" ON "area" ("nombre");

-- Consulta por (activo) limitada a las filas del filtro WHERE.

CREATE INDEX "idx_area_activo" ON "area" ("activo")
WHERE (activo = true);

-- Consulta por (deleted_at) limitada a las filas del filtro WHERE.

CREATE INDEX "idx_area_deleted" ON "area" ("deleted_at")
WHERE (deleted_at IS NULL);

-- ------------------------------------------------------------------------------------------------
-- 3.2. cargo — Cargos y puestos de trabajo
-- Define el puesto y su área. Sus referencias salariales no sustituyen el sueldo individual ni
-- la RMV vigente.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "cargo" (
    "id" UUID NOT NULL,
    "id_area" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    -- Referencia del cargo; no actualiza automáticamente la RMV legal vigente.
    "sueldo_minimo" DECIMAL(12, 4) DEFAULT 1130.00,
    "sueldo_maximo" DECIMAL(12, 4),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "cargo_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "cargo" IS 'Define el puesto y su área. Sus referencias salariales no sustituyen el sueldo individual ni la RMV vigente.';

COMMENT ON COLUMN "cargo"."sueldo_minimo" IS 'Referencia del cargo; no actualiza automáticamente la RMV legal vigente.';

-- Índices de cargo. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (id_area).

CREATE INDEX "idx_cargo_area" ON "cargo" ("id_area");

-- Consulta por (activo) limitada a las filas del filtro WHERE.

CREATE INDEX "idx_cargo_activo" ON "cargo" ("activo")
WHERE (activo = true);

-- Consulta por (deleted_at) limitada a las filas del filtro WHERE.

CREATE INDEX "idx_cargo_deleted" ON "cargo" ("deleted_at")
WHERE (deleted_at IS NULL);

-- ------------------------------------------------------------------------------------------------
-- 3.3. jornada — Catálogo de jornadas laborales
-- Describe horario semanal, modalidad, turno y tolerancia. La asistencia histórica utiliza una
-- copia fechada en asistencia_jornada.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "jornada" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "duracion" "duracion_jornada_enum" NOT NULL DEFAULT 'TIEMPO_COMPLETO',
    "turno" "turno_jornada_enum" NOT NULL DEFAULT 'MANANA',
    "modalidad" "modalidad_jornada_enum" NOT NULL DEFAULT 'PRESENCIAL',
    -- Minutos de tolerancia; el historial copia este valor al asignarse.
    "tolerancia_minutos" INTEGER NOT NULL DEFAULT 5,
    -- Horas efectivas declaradas; 40 es el valor por defecto, no un límite universal.
    "total_horas_semana" DECIMAL(5, 2) NOT NULL DEFAULT 40.00,
    -- JSON con los siete días, horas de trabajo, refrigerio y condición laborable.
    "horario_semanal" JSONB NOT NULL,
    "patron_rotacion" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "jornada_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "jornada" IS 'Describe horario semanal, modalidad, turno y tolerancia. La asistencia histórica utiliza una copia fechada en asistencia_jornada.';

COMMENT ON COLUMN "jornada"."horario_semanal" IS 'JSON con los siete días, horas de trabajo, refrigerio y condición laborable.';

COMMENT ON COLUMN "jornada"."total_horas_semana" IS 'Horas efectivas declaradas; 40 es el valor por defecto, no un límite universal.';

COMMENT ON COLUMN "jornada"."tolerancia_minutos" IS 'Minutos de tolerancia; el historial copia este valor al asignarse.';

-- Índices de jornada. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (activo) limitada a las filas del filtro WHERE.

CREATE INDEX "idx_jornada_activo" ON "jornada" ("activo")
WHERE (activo = true);

-- Consulta por (modalidad).

CREATE INDEX "idx_jornada_modalidad" ON "jornada" ("modalidad");

-- Consulta por (turno).

CREATE INDEX "idx_jornada_turno" ON "jornada" ("turno");

-- Consulta por (duracion).

CREATE INDEX "idx_jornada_duracion" ON "jornada" ("duracion");

-- ------------------------------------------------------------------------------------------------
-- 3.4. jornada_area — Áreas habilitadas para una jornada
-- Relación de varios a varios entre jornadas y áreas; no representa la asignación individual
-- histórica de un empleado.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "jornada_area" (
    "jornada_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    CONSTRAINT "jornada_area_pkey" PRIMARY KEY ("jornada_id", "area_id")
);

COMMENT ON TABLE "jornada_area" IS 'Relación de varios a varios entre jornadas y áreas; no representa la asignación individual histórica de un empleado.';

-- Índices de jornada_area. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (area_id).

CREATE INDEX "idx_jornada_area_area" ON "jornada_area" ("area_id");

-- ================================================================================================
-- 4. CONFIGURACIÓN PREVISIONAL Y PARÁMETROS
-- ================================================================================================

-- ------------------------------------------------------------------------------------------------
-- 4.1. tipo_afp — Administradoras de fondos de pensiones
-- Cada AFP pertenece a un régimen pensionario y tiene sus porcentajes por vigencia en
-- comisiones_afp.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "tipo_afp" (
    "id" UUID NOT NULL,
    "id_regimen" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    CONSTRAINT "tipo_afp_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "tipo_afp" IS 'Cada AFP pertenece a un régimen pensionario y tiene sus porcentajes por vigencia en comisiones_afp.';

-- Índices de tipo_afp. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (id_regimen).

CREATE INDEX "idx_tipo_afp_regimen" ON "tipo_afp" ("id_regimen");

-- ------------------------------------------------------------------------------------------------
-- 4.2. comisiones_afp — Tasas y topes previsionales por vigencia
-- Mantiene aporte, comisiones, prima y tope asegurable por AFP. Los porcentajes se almacenan en
-- puntos porcentuales: 1.37 significa 1,37 %.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "comisiones_afp" (
    "id" UUID NOT NULL,
    "afp_id" UUID NOT NULL,
    "aporte_obligatorio" DECIMAL(6, 4) NOT NULL DEFAULT 10.0000,
    "comision_sobre_ra" DECIMAL(6, 4) NOT NULL DEFAULT 0.0000,
    "prima_seguro" DECIMAL(6, 4) NOT NULL DEFAULT 0.0000,
    -- Comisión anual sobre saldo; se distingue del componente mensual sobre remuneración.
    "comision_mixta" DECIMAL(6, 4) NOT NULL DEFAULT 0.0000,
    -- Componente de flujo de la comisión mixta, expresado en puntos porcentuales.
    "comision_flujo_mixta" DECIMAL(6, 4),
    -- Tope en soles utilizado para la prima del seguro previsional.
    "remuneracion_maxima_asegurable" DECIMAL(12, 4),
    -- Primer día de vigencia, incluido.
    "periodo_inicio" DATE NOT NULL,
    -- Último día de vigencia, incluido; NULL representa un extremo abierto.
    "periodo_final" DATE,
    CONSTRAINT "comisiones_afp_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "comisiones_afp" IS 'Mantiene aporte, comisiones, prima y tope asegurable por AFP. Los porcentajes se almacenan en puntos porcentuales: 1.37 significa 1,37 %.';

COMMENT ON COLUMN "comisiones_afp"."comision_mixta" IS 'Comisión anual sobre saldo; se distingue del componente mensual sobre remuneración.';

COMMENT ON COLUMN "comisiones_afp"."comision_flujo_mixta" IS 'Componente de flujo de la comisión mixta, expresado en puntos porcentuales.';

COMMENT ON COLUMN "comisiones_afp"."remuneracion_maxima_asegurable" IS 'Tope en soles utilizado para la prima del seguro previsional.';

COMMENT ON COLUMN "comisiones_afp"."periodo_inicio" IS 'Primer día de vigencia, incluido.';

COMMENT ON COLUMN "comisiones_afp"."periodo_final" IS 'Último día de vigencia, incluido; NULL representa un extremo abierto.';

-- Índices de comisiones_afp. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (afp_id, periodo_inicio).

CREATE INDEX "idx_comisiones_afp_fechas" ON "comisiones_afp" ("afp_id", "periodo_inicio");

-- ------------------------------------------------------------------------------------------------
-- 4.3. parametro_legal — Parámetros legales y de configuración por vigencia
-- Conserva valores por código y fechas. En las tasas terminadas en _PCT, 0.09 representa 9 %. El
-- valor de Vida Ley requiere la póliza de la empresa.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "parametro_legal" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    -- Monto o fracción según código: RMV/UIT en soles; _PCT como 0.09 para 9 %.
    "valor" DECIMAL(12, 4) NOT NULL,
    -- Inicio incluido de la vigencia del código.
    "vigente_desde" DATE NOT NULL,
    -- Fin incluido; NULL indica que no se fijó fecha de término.
    "vigente_hasta" DATE,
    "descripcion" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parametro_legal_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "parametro_legal" IS 'Conserva valores por código y fechas. En las tasas terminadas en _PCT, 0.09 representa 9 %. El valor de Vida Ley requiere la póliza de la empresa.';

COMMENT ON COLUMN "parametro_legal"."valor" IS 'Monto o fracción según código: RMV/UIT en soles; _PCT como 0.09 para 9 %.';

COMMENT ON COLUMN "parametro_legal"."vigente_desde" IS 'Inicio incluido de la vigencia del código.';

COMMENT ON COLUMN "parametro_legal"."vigente_hasta" IS 'Fin incluido; NULL indica que no se fijó fecha de término.';

-- Índices de parametro_legal. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (codigo, vigente_desde, vigente_hasta).

CREATE INDEX "idx_parametro_busqueda" ON "parametro_legal" (
    "codigo",
    "vigente_desde",
    "vigente_hasta"
);

-- Unicidad de (codigo, vigente_desde): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "uq_parametro_codigo_vigencia" ON "parametro_legal" ("codigo", "vigente_desde");

-- ================================================================================================
-- 5. LEGAJO, CONTRATOS Y DERECHOHABIENTES
-- ================================================================================================

-- ------------------------------------------------------------------------------------------------
-- 5.1. empleados — Legajo del colaborador
-- Identidad, datos de contacto y vínculo con área, cargo y referencias laborales. fecha_inicio y
-- fecha_cese delimitan los días que se pueden evaluar.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "empleados" (
    "id" UUID NOT NULL,
    "cargo_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,
    -- Referencia del legajo; la asistencia por fecha consulta asistencia_jornada.
    "jornada_id" UUID,
    "estado_laboral" "estado_empleado_enum" NOT NULL DEFAULT 'ACTIVO',
    "nombre" VARCHAR(100),
    "apellido" VARCHAR(100),
    "nro_documento" VARCHAR(20) NOT NULL,
    "email" VARCHAR(150),
    "telefono" VARCHAR(20),
    "sexo" "sexo_enum",
    "estado_civil" "estado_civil_enum" NOT NULL DEFAULT 'SOLTERO',
    "nacionalidad" VARCHAR(50) NOT NULL DEFAULT 'PERUANA',
    "fecha_nacimiento" DATE,
    "direccion" VARCHAR(255),
    "referencia_direccion" VARCHAR(255),
    "ubigeo" VARCHAR(6),
    "distrito" VARCHAR(100),
    "provincia" VARCHAR(100),
    "departamento" VARCHAR(100),
    -- Ingreso que delimita los días incluidos en asistencia y planilla.
    "fecha_inicio" DATE,
    -- Cese que delimita el vínculo; el mes de cese requiere liquidación específica.
    "fecha_cese" DATE,
    "afp_fecha_filiacion" DATE,
    "asig_familiar" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado_sincronizacion" "estado_sincronizacion_enum" NOT NULL DEFAULT 'COMPLETO',
    CONSTRAINT "empleados_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "empleados" IS 'Identidad, datos de contacto y vínculo con área, cargo y referencias laborales. fecha_inicio y fecha_cese delimitan los días que se pueden evaluar.';

COMMENT ON COLUMN "empleados"."jornada_id" IS 'Referencia del legajo; la asistencia por fecha consulta asistencia_jornada.';

COMMENT ON COLUMN "empleados"."fecha_inicio" IS 'Ingreso que delimita los días incluidos en asistencia y planilla.';

COMMENT ON COLUMN "empleados"."fecha_cese" IS 'Cese que delimita el vínculo; el mes de cese requiere liquidación específica.';

-- Índices de empleados. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (nro_documento): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "empleados_nro_documento_key" ON "empleados" ("nro_documento");

-- Consulta por (activo) limitada a las filas del filtro WHERE.

CREATE INDEX "idx_empleado_activo" ON "empleados" ("activo")
WHERE (activo = true);

-- Consulta por (estado_laboral).

CREATE INDEX "idx_empleado_estado_laboral" ON "empleados" ("estado_laboral");

-- Consulta por (area_id).

CREATE INDEX "idx_empleado_area" ON "empleados" ("area_id");

-- Consulta por (cargo_id).

CREATE INDEX "idx_empleado_cargo" ON "empleados" ("cargo_id");

-- Consulta por (deleted_at) limitada a las filas del filtro WHERE.

CREATE INDEX "idx_empleado_deleted" ON "empleados" ("deleted_at")
WHERE (deleted_at IS NULL);

-- ------------------------------------------------------------------------------------------------
-- 5.2. contratos — Contratos laborales
-- Documento y vigencias de contratación. Conserva información de renovación, estado y archivo
-- asociado.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "contratos" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "estado" "estado_contrato_enum" NOT NULL DEFAULT 'VIGENTE',
    "id_estado" UUID,
    "contrato_origen_id" UUID,
    "tipo_modalidad" VARCHAR(100),
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "renovado" BOOLEAN NOT NULL DEFAULT false,
    "observacion" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" VARCHAR(225),
    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "contratos" IS 'Documento y vigencias de contratación. Conserva información de renovación, estado y archivo asociado.';

-- Índices de contratos. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (deleted_at) limitada a las filas del filtro WHERE.

CREATE INDEX "idx_contratos_deleted" ON "contratos" ("deleted_at")
WHERE (deleted_at IS NULL);

-- Consulta por (empleado_id).

CREATE INDEX "idx_contratos_empleado" ON "contratos" ("empleado_id");

-- Consulta por (estado).

CREATE INDEX "idx_contratos_estado" ON "contratos" ("estado");

-- ------------------------------------------------------------------------------------------------
-- 5.3. dato_financiero — Datos económicos del colaborador
-- Un registro por empleado con sueldo, pensión, salud y cuentas bancarias. El cifrado de las
-- cuentas corresponde a la aplicación.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "dato_financiero" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "id_regimen" UUID NOT NULL,
    "id_tipo_afp" UUID,
    -- Sueldo individual mensual; no se sustituye por la referencia del cargo.
    "sueldo_basico" DECIMAL(12, 4) NOT NULL DEFAULT 0,
    "cuspp" VARCHAR(20),
    "tipo_comision" VARCHAR(50),
    "id_banco_sueldo" UUID,
    "tipo_cuenta_sueldo" "tipo_cuenta_bancaria_enum" NOT NULL DEFAULT 'SUELDO',
    -- Valor protegido por cifrado desde la aplicación.
    "nro_cuenta_sueldo" VARCHAR(255),
    -- CCI protegido por cifrado desde la aplicación.
    "cci_sueldo" VARCHAR(255),
    "id_banco_cts" UUID,
    "tipo_cuenta_cts" "tipo_cuenta_bancaria_enum" NOT NULL DEFAULT 'AHORROS',
    -- Cuenta CTS protegida por cifrado desde la aplicación.
    "nro_cuenta_cts" VARCHAR(255),
    -- CCI CTS protegido por cifrado desde la aplicación.
    "cci_cts" VARCHAR(255),
    "regimen_salud" "regimen_salud_enum" NOT NULL DEFAULT 'ESSALUD_REGULAR',
    "eps_nombre" VARCHAR(100),
    "eps_plan" VARCHAR(100),
    "eps_costo_adicional" DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dato_financiero_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "dato_financiero" IS 'Un registro por empleado con sueldo, pensión, salud y cuentas bancarias. El cifrado de las cuentas corresponde a la aplicación.';

COMMENT ON COLUMN "dato_financiero"."sueldo_basico" IS 'Sueldo individual mensual; no se sustituye por la referencia del cargo.';

COMMENT ON COLUMN "dato_financiero"."nro_cuenta_sueldo" IS 'Valor protegido por cifrado desde la aplicación.';

COMMENT ON COLUMN "dato_financiero"."cci_sueldo" IS 'CCI protegido por cifrado desde la aplicación.';

COMMENT ON COLUMN "dato_financiero"."nro_cuenta_cts" IS 'Cuenta CTS protegida por cifrado desde la aplicación.';

COMMENT ON COLUMN "dato_financiero"."cci_cts" IS 'CCI CTS protegido por cifrado desde la aplicación.';

-- Índices de dato_financiero. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (empleado_id): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "dato_financiero_empleado_id_key" ON "dato_financiero" ("empleado_id");

-- Consulta por (empleado_id).

CREATE INDEX "idx_dato_fin_empleado" ON "dato_financiero" ("empleado_id");

-- ------------------------------------------------------------------------------------------------
-- 5.4. derechohabientes — Familiares y derechohabientes
-- Identificación y vínculo familiar de las personas declaradas por el colaborador.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "derechohabientes" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,
    "nro_documento" VARCHAR(20) NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos" VARCHAR(100) NOT NULL,
    "vinculo" "vinculo_familiar_enum" NOT NULL,
    "estado_civil" "estado_civil_enum" NOT NULL DEFAULT 'SOLTERO',
    "sexo" "sexo_enum" NOT NULL,
    "fecha_nacimiento" DATE NOT NULL,
    "acreditado_essalud" BOOLEAN NOT NULL DEFAULT false,
    "fecha_alta_seguro" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "derechohabientes_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "derechohabientes" IS 'Identificación y vínculo familiar de las personas declaradas por el colaborador.';

-- Índices de derechohabientes. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (empleado_id).

CREATE INDEX "idx_dh_empleado" ON "derechohabientes" ("empleado_id");

-- Consulta por (activo) limitada a las filas del filtro WHERE.

CREATE INDEX "idx_dh_activo" ON "derechohabientes" ("activo")
WHERE (activo = true);

-- Consulta por (deleted_at) limitada a las filas del filtro WHERE.

CREATE INDEX "idx_dh_deleted" ON "derechohabientes" ("deleted_at")
WHERE (deleted_at IS NULL);

-- Unicidad de (empleado_id, nro_documento): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "uq_empleado_derechohabiente" ON "derechohabientes" (
    "empleado_id",
    "nro_documento"
);

-- ------------------------------------------------------------------------------------------------
-- 5.5. derechohabiente_documentos — Sustentos de derechohabientes
-- Registra metadatos de los archivos que sustentan el vínculo o la condición del
-- derechohabiente.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "derechohabiente_documentos" (
    "id" UUID NOT NULL,
    "derechohabiente_id" UUID NOT NULL,
    "tipo_documento" "tipo_sustento_familiar_enum" NOT NULL,
    "nombre_archivo" VARCHAR(150) NOT NULL,
    "archivo_url" VARCHAR(255) NOT NULL,
    "fecha_emision" DATE,
    "fecha_vencimiento" DATE,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "derechohabiente_documentos_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "derechohabiente_documentos" IS 'Registra metadatos de los archivos que sustentan el vínculo o la condición del derechohabiente.';

-- Índices de derechohabiente_documentos. Las claves primarias se declararon dentro de CREATE
-- TABLE.

-- Consulta por (derechohabiente_id).

CREATE INDEX "idx_dhd_derechohabiente" ON "derechohabiente_documentos" ("derechohabiente_id");

-- Consulta por (vigente) limitada a las filas del filtro WHERE.

CREATE INDEX "idx_dhd_vigente" ON "derechohabiente_documentos" ("vigente")
WHERE (vigente = true);

-- Consulta por (fecha_vencimiento).

CREATE INDEX "idx_dhd_vencimiento" ON "derechohabiente_documentos" ("fecha_vencimiento");

-- ================================================================================================
-- 6. SOLICITUDES DE RECURSOS HUMANOS
-- ================================================================================================

-- ------------------------------------------------------------------------------------------------
-- 6.1. solicitud — Solicitudes y revisión de RRHH
-- Conserva el trámite, beneficiario, responsable y dictamen. Las solicitudes de asistencia
-- también especifican fechas, horas y efecto remunerativo.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "solicitud" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    -- Beneficiario del trámite; puede diferir de quien ejecutó la operación.
    "empleado_id" UUID NOT NULL,
    "tipo" "TipoSolicitud" NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_inicio" DATE,
    "fecha_fin" DATE,
    -- Inicio HH:mm del permiso parcial; debe ser coherente con hora_fin y sus fechas.
    "hora_inicio" VARCHAR(5),
    -- Fin HH:mm del permiso parcial del mismo día.
    "hora_fin" VARCHAR(5),
    -- Clasificación remunerativa de la solicitud para cruzarla con asistencia.
    "efecto_asistencia" VARCHAR(25) NOT NULL DEFAULT 'PENDIENTE_DEFINIR',
    "dias_solicitados" INTEGER DEFAULT 1,
    "monto" DECIMAL(12, 4),
    "motivo" TEXT NOT NULL,
    "observacion" TEXT,
    "sustento_url" VARCHAR(255),
    "sustento_nombre" VARCHAR(150),
    -- Usuario que tomó la revisión y puede emitir el dictamen.
    "responsable_id" UUID,
    "fecha_limite" DATE,
    "origen" VARCHAR(50) NOT NULL DEFAULT 'PORTAL_EMPLEADO',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "solicitud_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "solicitud" IS 'Conserva el trámite, beneficiario, responsable y dictamen. Las solicitudes de asistencia también especifican fechas, horas y efecto remunerativo.';

COMMENT ON COLUMN "solicitud"."empleado_id" IS 'Beneficiario del trámite; puede diferir de quien ejecutó la operación.';

COMMENT ON COLUMN "solicitud"."responsable_id" IS 'Usuario que tomó la revisión y puede emitir el dictamen.';

COMMENT ON COLUMN "solicitud"."efecto_asistencia" IS 'Clasificación remunerativa de la solicitud para cruzarla con asistencia.';

COMMENT ON COLUMN "solicitud"."hora_inicio" IS 'Inicio HH:mm del permiso parcial; debe ser coherente con hora_fin y sus fechas.';

COMMENT ON COLUMN "solicitud"."hora_fin" IS 'Fin HH:mm del permiso parcial del mismo día.';

-- Índices de solicitud. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (codigo): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "solicitud_codigo_key" ON "solicitud" ("codigo");

-- Consulta por (empleado_id).

CREATE INDEX "idx_solicitud_empleado" ON "solicitud" ("empleado_id");

-- Consulta por (estado).

CREATE INDEX "idx_solicitud_estado" ON "solicitud" ("estado");

-- Consulta por (tipo).

CREATE INDEX "idx_solicitud_tipo" ON "solicitud" ("tipo");

-- ================================================================================================
-- 7. ASISTENCIA, EVIDENCIA Y CONSOLIDACIÓN
-- ================================================================================================

-- ------------------------------------------------------------------------------------------------
-- 7.1. asistencia_marcacion — Marcaciones originales
-- Evidencia de entrada/salida importada o manual. Las correcciones se sustentan en decisiones
-- sin reemplazar las marcas originales.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "asistencia_marcacion" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    -- Instante con zona horaria; el día laboral se determina en America/Lima.
    "fecha_hora" TIMESTAMPTZ(6) NOT NULL,
    "tipo_marcacion" "tipo_marcacion_enum" NOT NULL,
    "metodo" VARCHAR(50) NOT NULL,
    "motivo" VARCHAR(1000),
    -- Usuario responsable del registro manual o de la importación.
    "usuario_id" UUID,
    -- Referencia a la huella del archivo de origen, cuando procede.
    "importacion_id" VARCHAR(64),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asistencia_marcacion_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "asistencia_marcacion" IS 'Evidencia de entrada/salida importada o manual. Las correcciones se sustentan en decisiones sin reemplazar las marcas originales.';

COMMENT ON COLUMN "asistencia_marcacion"."fecha_hora" IS 'Instante con zona horaria; el día laboral se determina en America/Lima.';

COMMENT ON COLUMN "asistencia_marcacion"."importacion_id" IS 'Referencia a la huella del archivo de origen, cuando procede.';

COMMENT ON COLUMN "asistencia_marcacion"."usuario_id" IS 'Usuario responsable del registro manual o de la importación.';

-- Índices de asistencia_marcacion. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (empleado_id, fecha_hora).

CREATE INDEX "idx_asistencia_emp_fecha" ON "asistencia_marcacion" ("empleado_id", "fecha_hora");

-- Unicidad de (empleado_id, fecha_hora, tipo_marcacion): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "uq_marcacion_instante_tipo" ON "asistencia_marcacion" (
    "empleado_id",
    "fecha_hora",
    "tipo_marcacion"
);

-- ------------------------------------------------------------------------------------------------
-- 7.2. asistencia_jornada — Jornada efectiva por fecha
-- Copia el horario asignado desde una fecha. Para evaluar un día se selecciona la última
-- vigencia con desde menor o igual a ese día.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "asistencia_jornada" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    -- Desde esta fecha se elige esta copia hasta la siguiente vigencia del empleado.
    "desde" DATE NOT NULL,
    "jornada_id" UUID NOT NULL,
    -- Copia del horario que conserva la programación histórica.
    "horario" JSONB NOT NULL,
    "tolerancia_minutos" INTEGER NOT NULL,
    -- COMPLETA descuenta toda tardanza que supera tolerancia; EXCESO sólo el exceso.
    "politica_tolerancia" VARCHAR(15) NOT NULL DEFAULT 'COMPLETA',
    -- Minutos efectivos semanales: 2400 equivale a 40 h y 2880 a 48 h.
    "minutos_semana" INTEGER NOT NULL,
    "motivo" VARCHAR(1000) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asistencia_jornada_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "asistencia_jornada" IS 'Copia el horario asignado desde una fecha. Para evaluar un día se selecciona la última vigencia con desde menor o igual a ese día.';

COMMENT ON COLUMN "asistencia_jornada"."desde" IS 'Desde esta fecha se elige esta copia hasta la siguiente vigencia del empleado.';

COMMENT ON COLUMN "asistencia_jornada"."horario" IS 'Copia del horario que conserva la programación histórica.';

COMMENT ON COLUMN "asistencia_jornada"."minutos_semana" IS 'Minutos efectivos semanales: 2400 equivale a 40 h y 2880 a 48 h.';

COMMENT ON COLUMN "asistencia_jornada"."politica_tolerancia" IS 'COMPLETA descuenta toda tardanza que supera tolerancia; EXCESO sólo el exceso.';

-- Índices de asistencia_jornada. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (empleado_id, desde): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "uq_asistencia_jornada_desde" ON "asistencia_jornada" ("empleado_id", "desde");

-- ------------------------------------------------------------------------------------------------
-- 7.3. asistencia_decision — Decisiones diarias de asistencia
-- Resolución motivada de ausencias, marcaciones o sobretiempo. Conserva responsable y versión.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "asistencia_decision" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    -- Detalle JSON según tipo: resolución de ausencia, marcas corregidas o sobretiempo.
    "datos" JSONB NOT NULL,
    -- Sustento de la resolución, conservado junto al usuario.
    "motivo" VARCHAR(1000) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asistencia_decision_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "asistencia_decision" IS 'Resolución motivada de ausencias, marcaciones o sobretiempo. Conserva responsable y versión.';

COMMENT ON COLUMN "asistencia_decision"."datos" IS 'Detalle JSON según tipo: resolución de ausencia, marcas corregidas o sobretiempo.';

COMMENT ON COLUMN "asistencia_decision"."motivo" IS 'Sustento de la resolución, conservado junto al usuario.';

-- Índices de asistencia_decision. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (empleado_id, fecha, tipo): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "uq_decision_dia_tipo" ON "asistencia_decision" (
    "empleado_id",
    "fecha",
    "tipo"
);

-- ------------------------------------------------------------------------------------------------
-- 7.4. asistencia_calendario — Descansos adicionales
-- Fechas configuradas por RRHH que complementan los feriados nacionales calculados en el
-- dominio.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "asistencia_calendario" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "motivo" VARCHAR(1000) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "usuario_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asistencia_calendario_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "asistencia_calendario" IS 'Fechas configuradas por RRHH que complementan los feriados nacionales calculados en el dominio.';

-- Índices de asistencia_calendario. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (fecha): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "asistencia_calendario_fecha_key" ON "asistencia_calendario" ("fecha");

-- ------------------------------------------------------------------------------------------------
-- 7.5. incidencias_mes — Resumen mensual de asistencia
-- Consolida minutos, días, pendientes y detalle diario. Su aprobación exige fuentes vigentes,
-- cálculo completo y responsable identificable.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "incidencias_mes" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    -- Días remunerables del cálculo mensual; el mes completo conserva base comercial de 30.
    "dias_trabajados" INTEGER NOT NULL DEFAULT 0,
    "faltas" INTEGER NOT NULL DEFAULT 0,
    "minutos_tardanza" INTEGER NOT NULL DEFAULT 0,
    "dias_vinculo" INTEGER NOT NULL DEFAULT 0,
    "dias_sin_goce" INTEGER NOT NULL DEFAULT 0,
    "minutos_sin_goce" INTEGER NOT NULL DEFAULT 0,
    "minutos_salida_anticipada" INTEGER NOT NULL DEFAULT 0,
    "minutos_extras_25" INTEGER NOT NULL DEFAULT 0,
    "minutos_extras_35" INTEGER NOT NULL DEFAULT 0,
    -- Asuntos por resolver; deben ser cero para aprobar.
    "pendientes" INTEGER NOT NULL DEFAULT 0,
    -- Indica si el período puede cerrarse según la evaluación del motor.
    "completo" BOOLEAN NOT NULL DEFAULT false,
    -- Indica si el resumen conserva sus fuentes; no equivale a estar aprobado.
    "vigente" BOOLEAN NOT NULL DEFAULT false,
    -- Revisión del resumen utilizada para detectar cambios concurrentes.
    "version" INTEGER NOT NULL DEFAULT 1,
    -- Huella de las fuentes y revisión del motor al generar el resumen.
    "fuente_hash" VARCHAR(64),
    -- Resultado diario que permite revisar cómo se llegó a los totales.
    "detalle" JSONB,
    "motivo_revision" VARCHAR(1000),
    "aprobado_por" UUID,
    "aprobado_en" TIMESTAMPTZ(6),
    "horas_extras_25" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "horas_extras_35" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "estado" "estado_incidencia_enum" NOT NULL DEFAULT 'PENDIENTE',
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incidencias_mes_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "incidencias_mes" IS 'Consolida minutos, días, pendientes y detalle diario. Su aprobación exige fuentes vigentes, cálculo completo y responsable identificable.';

COMMENT ON COLUMN "incidencias_mes"."dias_trabajados" IS 'Días remunerables del cálculo mensual; el mes completo conserva base comercial de 30.';

COMMENT ON COLUMN "incidencias_mes"."vigente" IS 'Indica si el resumen conserva sus fuentes; no equivale a estar aprobado.';

COMMENT ON COLUMN "incidencias_mes"."completo" IS 'Indica si el período puede cerrarse según la evaluación del motor.';

COMMENT ON COLUMN "incidencias_mes"."pendientes" IS 'Asuntos por resolver; deben ser cero para aprobar.';

COMMENT ON COLUMN "incidencias_mes"."fuente_hash" IS 'Huella de las fuentes y revisión del motor al generar el resumen.';

COMMENT ON COLUMN "incidencias_mes"."detalle" IS 'Resultado diario que permite revisar cómo se llegó a los totales.';

COMMENT ON COLUMN "incidencias_mes"."version" IS 'Revisión del resumen utilizada para detectar cambios concurrentes.';

-- Índices de incidencias_mes. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (empleado_id, periodo): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "uq_incidencia_periodo" ON "incidencias_mes" ("empleado_id", "periodo");

-- ================================================================================================
-- 8. PLANILLAS, NOVEDADES Y ADELANTOS
-- ================================================================================================

-- ------------------------------------------------------------------------------------------------
-- 8.1. historial_planillas — Resultado y cierre de la planilla
-- Una planilla por empleado y período. Guarda importes e instantánea de cálculo; los triggers
-- protegen sus estados congelados o declarados.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "historial_planillas" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    -- Mes liquidado con formato YYYY-MM.
    "periodo" VARCHAR(7) NOT NULL,
    "dias_laborados" INTEGER NOT NULL DEFAULT 30,
    -- Revisión que el contador debe confirmar al congelar.
    "version" INTEGER NOT NULL DEFAULT 1,
    -- Versión del resumen de asistencia que originó el cálculo.
    "incidencia_version" INTEGER,
    -- Huella de los insumos de payroll para detectar cambios antes del cierre.
    "fuente_hash" VARCHAR(64),
    -- Instantánea de entrada, resultados y cabecera que permite reconstruir la boleta.
    "snapshot_calculo" JSONB,
    -- Usuario contador que realizó el cierre.
    "validado_por" UUID,
    "validado_en" TIMESTAMPTZ(6),
    "sueldo_base" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "asignacion_familia" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "horas_extras_25" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "horas_extras_35" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "recargo_nocturno" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "gratificacion" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "bonif_extraordinaria" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "descuento_faltas" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "descuento_tardanzas" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "descuento_sin_goce" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "descuento_onp" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "descuento_afp_fondo" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "descuento_afp_seguro" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "descuento_afp_comision" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "tasa_afp_aplicada" DECIMAL(6, 4),
    "descuento_quinta" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "descuento_adelanto" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "descuento_eps" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "aporte_essalud" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "aporte_vida_ley" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "total_ingresos" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "total_descuentos" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "neto_a_pagar" DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    "estado" "estado_planilla_enum" NOT NULL DEFAULT 'ABIERTO',
    "comentarios" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "bono_extraordinario" DECIMAL(12, 4) NOT NULL DEFAULT 0,
    "descuento_autorizado" DECIMAL(12, 4) NOT NULL DEFAULT 0,
    "descuento_dso" DECIMAL(12, 4) NOT NULL DEFAULT 0,
    "base_essalud" DECIMAL(12, 4) NOT NULL DEFAULT 0,
    "base_previsional" DECIMAL(12, 4) NOT NULL DEFAULT 0,
    CONSTRAINT "historial_planillas_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "historial_planillas" IS 'Una planilla por empleado y período. Guarda importes e instantánea de cálculo; los triggers protegen sus estados congelados o declarados.';

COMMENT ON COLUMN "historial_planillas"."periodo" IS 'Mes liquidado con formato YYYY-MM.';

COMMENT ON COLUMN "historial_planillas"."snapshot_calculo" IS 'Instantánea de entrada, resultados y cabecera que permite reconstruir la boleta.';

COMMENT ON COLUMN "historial_planillas"."incidencia_version" IS 'Versión del resumen de asistencia que originó el cálculo.';

COMMENT ON COLUMN "historial_planillas"."fuente_hash" IS 'Huella de los insumos de payroll para detectar cambios antes del cierre.';

COMMENT ON COLUMN "historial_planillas"."validado_por" IS 'Usuario contador que realizó el cierre.';

COMMENT ON COLUMN "historial_planillas"."version" IS 'Revisión que el contador debe confirmar al congelar.';

-- Índices de historial_planillas. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (periodo, estado).

CREATE INDEX "idx_planilla_periodo_estado" ON "historial_planillas" ("periodo", "estado");

-- Unicidad de (empleado_id, periodo): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "uq_empleado_periodo" ON "historial_planillas" ("empleado_id", "periodo");

-- ------------------------------------------------------------------------------------------------
-- 8.2. novedad_planilla — Conceptos variables y su visado
-- Registra bonos/descuentos con evidencia y resolución contable antes de incorporarlos a la
-- planilla.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "novedad_planilla" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "monto" DECIMAL(12, 4) NOT NULL,
    "motivo" VARCHAR(1000) NOT NULL,
    -- Referencia del sustento que justifica el bono o descuento.
    "referencia_evidencia" VARCHAR(255) NOT NULL,
    -- Sólo los conceptos visados se incorporan; la resolución conserva al contador.
    "estado" VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',
    "registrado_por" UUID NOT NULL,
    "resuelto_por" UUID,
    "motivo_resolucion" VARCHAR(1000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "novedad_planilla_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "novedad_planilla" IS 'Registra bonos/descuentos con evidencia y resolución contable antes de incorporarlos a la planilla.';

COMMENT ON COLUMN "novedad_planilla"."estado" IS 'Sólo los conceptos visados se incorporan; la resolución conserva al contador.';

COMMENT ON COLUMN "novedad_planilla"."referencia_evidencia" IS 'Referencia del sustento que justifica el bono o descuento.';

-- Índices de novedad_planilla. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (empleado_id, periodo).

CREATE INDEX "novedad_planilla_empleado_id_periodo_idx" ON "novedad_planilla" ("empleado_id", "periodo");

-- ------------------------------------------------------------------------------------------------
-- 8.3. adelanto_desembolso — Entrega efectiva de un adelanto
-- Prueba de entrega de dinero asociada a una solicitud aprobada. La solicitud es única para
-- evitar descontar la misma entrega dos veces.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "adelanto_desembolso" (
    "id" UUID NOT NULL,
    -- Solicitud aprobada de adelanto asociada a esta única entrega.
    "solicitud_id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "monto" DECIMAL(12, 4) NOT NULL,
    "fecha" DATE NOT NULL,
    -- Mes en que payroll descuenta el dinero efectivamente entregado.
    "periodo_descuento" VARCHAR(7) NOT NULL,
    "referencia" VARCHAR(200) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "adelanto_desembolso_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "adelanto_desembolso" IS 'Prueba de entrega de dinero asociada a una solicitud aprobada. La solicitud es única para evitar descontar la misma entrega dos veces.';

COMMENT ON COLUMN "adelanto_desembolso"."solicitud_id" IS 'Solicitud aprobada de adelanto asociada a esta única entrega.';

COMMENT ON COLUMN "adelanto_desembolso"."periodo_descuento" IS 'Mes en que payroll descuenta el dinero efectivamente entregado.';

-- Índices de adelanto_desembolso. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (solicitud_id): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "adelanto_desembolso_solicitud_id_key" ON "adelanto_desembolso" ("solicitud_id");

-- Consulta por (empleado_id, periodo_descuento).

CREATE INDEX "adelanto_desembolso_empleado_id_periodo_descuento_idx" ON "adelanto_desembolso" (
    "empleado_id",
    "periodo_descuento"
);

-- ================================================================================================
-- 9. USUARIOS, SEGURIDAD Y AUDITORÍA
-- ================================================================================================

-- ------------------------------------------------------------------------------------------------
-- 9.1. usuarios — Cuentas y roles de acceso
-- Cuenta de autenticación vinculada a un empleado. Su ID identifica al actor de auditoría y
-- puede ser distinto del empleado beneficiario.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "rol" "rol_usuario_enum" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "ultimo_acceso" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "usuarios" IS 'Cuenta de autenticación vinculada a un empleado. Su ID identifica al actor de auditoría y puede ser distinto del empleado beneficiario.';

-- Índices de usuarios. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (empleado_id): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "usuarios_empleado_id_key" ON "usuarios" ("empleado_id");

-- Unicidad de (email): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios" ("email");

-- Consulta por (activo) limitada a las filas del filtro WHERE.

CREATE INDEX "idx_usuarios_activo" ON "usuarios" ("activo")
WHERE (activo = true);

-- Consulta por (deleted_at) limitada a las filas del filtro WHERE.

CREATE INDEX "idx_usuarios_deleted" ON "usuarios" ("deleted_at")
WHERE (deleted_at IS NULL);

-- Consulta por (email).

CREATE INDEX "idx_usuarios_email" ON "usuarios" ("email");

-- Consulta por (empleado_id).

CREATE INDEX "idx_usuarios_empleado" ON "usuarios" ("empleado_id");

-- ------------------------------------------------------------------------------------------------
-- 9.2. tokens_seguridad — Tokens de seguridad y sesiones
-- Conserva tokens según propósito, vencimiento y uso; la aplicación controla su validez y
-- consumo.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "tokens_seguridad" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "proposito" VARCHAR(50) NOT NULL,
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tokens_seguridad_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "tokens_seguridad" IS 'Conserva tokens según propósito, vencimiento y uso; la aplicación controla su validez y consumo.';

-- Índices de tokens_seguridad. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (id) limitada a las filas del filtro WHERE.

CREATE INDEX "idx_tokens_activos" ON "tokens_seguridad" ("id")
WHERE (usado = false);

-- Consulta por (usuario_id, proposito).

CREATE INDEX "idx_tokens_usuario" ON "tokens_seguridad" ("usuario_id", "proposito");

-- ------------------------------------------------------------------------------------------------
-- 9.3. audit_log — Bitácora de cambios
-- Registra tabla, fila, usuario, IP y valores antes/después. Las escrituras críticas de
-- asistencia/payroll usan auditoría SQL transaccional.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    -- Usuario responsable; los triggers lo obtienen del contexto transaccional app.usuario_id.
    "usuario_id" UUID,
    "accion" VARCHAR(100) NOT NULL,
    "tabla_afectada" VARCHAR(100) NOT NULL,
    "registro_id" UUID NOT NULL,
    -- Fila previa a la mutación, cuando corresponda.
    "valores_antes" JSONB,
    -- Fila posterior; los triggers de planilla omiten duplicar snapshot_calculo.
    "valores_despues" JSONB,
    -- Origen de la operación; los triggers lo obtienen del contexto transaccional app.ip.
    "direccion_ip" INET NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "audit_log" IS 'Registra tabla, fila, usuario, IP y valores antes/después. Las escrituras críticas de asistencia/payroll usan auditoría SQL transaccional.';

COMMENT ON COLUMN "audit_log"."valores_antes" IS 'Fila previa a la mutación, cuando corresponda.';

COMMENT ON COLUMN "audit_log"."valores_despues" IS 'Fila posterior; los triggers de planilla omiten duplicar snapshot_calculo.';

COMMENT ON COLUMN "audit_log"."usuario_id" IS 'Usuario responsable; los triggers lo obtienen del contexto transaccional app.usuario_id.';

COMMENT ON COLUMN "audit_log"."direccion_ip" IS 'Origen de la operación; los triggers lo obtienen del contexto transaccional app.ip.';

-- Índices de audit_log. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (created_at DESC).

CREATE INDEX "idx_audit_log_fecha" ON "audit_log" ("created_at" DESC);

-- Consulta por (tabla_afectada).

CREATE INDEX "idx_audit_log_tabla" ON "audit_log" ("tabla_afectada");

-- Consulta por (usuario_id).

CREATE INDEX "idx_audit_log_usuario" ON "audit_log" ("usuario_id");

-- ================================================================================================
-- 10. TAREAS Y CARGA MASIVA
-- ================================================================================================

-- ------------------------------------------------------------------------------------------------
-- 10.1. tareas_asistente — Tareas operativas del asistente
-- Asignación, seguimiento y fechas de tareas contables; separadas de una planilla calculada.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "tareas_asistente" (
    "id" UUID NOT NULL,
    "asignado_a" UUID NOT NULL,
    "asignado_por" UUID NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "fecha_entrega" DATE,
    "estado" "estado_tarea_enum" NOT NULL DEFAULT 'PENDIENTE',
    "anotaciones" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tareas_asistente_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "tareas_asistente" IS 'Asignación, seguimiento y fechas de tareas contables; separadas de una planilla calculada.';

-- Índices de tareas_asistente. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (asignado_a).

CREATE INDEX "idx_tareas_asignado_a" ON "tareas_asistente" ("asignado_a");

-- Consulta por (deleted_at) limitada a las filas del filtro WHERE.

CREATE INDEX "idx_tareas_deleted" ON "tareas_asistente" ("deleted_at")
WHERE (deleted_at IS NULL);

-- Consulta por (estado).

CREATE INDEX "idx_tareas_estado" ON "tareas_asistente" ("estado");

-- ------------------------------------------------------------------------------------------------
-- 10.2. anotacion_tareas — Anotaciones y adjuntos de tareas
-- Comentarios y evidencia asociados a una tarea y su autor.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "anotacion_tareas" (
    "id" UUID NOT NULL,
    "tarea_id" UUID NOT NULL,
    "asignado_por" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "anotacion_tareas_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "anotacion_tareas" IS 'Comentarios y evidencia asociados a una tarea y su autor.';

-- ------------------------------------------------------------------------------------------------
-- 10.3. carga_masiva_jobs — Seguimiento de cargas masivas
-- Estado y resultados persistidos del procesamiento de archivos de empleados. Los trabajos
-- BullMQ de payroll se consultan en su cola Redis.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "carga_masiva_jobs" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "total_registros" INTEGER NOT NULL DEFAULT 0,
    "procesados" INTEGER NOT NULL DEFAULT 0,
    "fallidos" INTEGER NOT NULL DEFAULT 0,
    "errores_detalle" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "estado_job_enum" NOT NULL DEFAULT 'EN_COLA',
    CONSTRAINT "carga_masiva_jobs_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "carga_masiva_jobs" IS 'Estado y resultados persistidos del procesamiento de archivos de empleados. Los trabajos BullMQ de payroll se consultan en su cola Redis.';

-- ================================================================================================
-- 11. MODELOS PREVISTOS PARA HISTORIA LABORAL Y BENEFICIOS
-- ================================================================================================

-- Estas tablas se conservan del modelo recibido. Sus flujos completos no forman parte de la
-- validación de planilla regular; no se agregan datos iniciales en ellas.

-- ------------------------------------------------------------------------------------------------
-- 11.1. vinculo_laboral — Historial de vínculos laborales previsto
-- Estructura conservada para distinguir períodos laborales. Su existencia no implica que el
-- motor mensual ya consuma todo este historial.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "vinculo_laboral" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_cese" DATE,
    "regimen_laboral" VARCHAR(40) NOT NULL DEFAULT 'GENERAL_PRIVADO',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vinculo_laboral_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "vinculo_laboral" IS 'Estructura conservada para distinguir períodos laborales. Su existencia no implica que el motor mensual ya consuma todo este historial.';

-- Índices de vinculo_laboral. Las claves primarias se declararon dentro de CREATE TABLE.

-- Consulta por (empleado_id, fecha_cese).

CREATE INDEX "idx_vinculo_empleado_cese" ON "vinculo_laboral" ("empleado_id", "fecha_cese");

-- Unicidad de (empleado_id, fecha_inicio): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "uq_vinculo_empleado_inicio" ON "vinculo_laboral" ("empleado_id", "fecha_inicio");

-- ------------------------------------------------------------------------------------------------
-- 11.2. historial_remuneracion — Historial salarial previsto
-- Estructura por vigencia y vínculo. El motor mensual actual obtiene el sueldo de
-- dato_financiero; la integración histórica completa sigue pendiente.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "historial_remuneracion" (
    "id" UUID NOT NULL,
    "vinculo_laboral_id" UUID NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE,
    "sueldo_basico" DECIMAL(18, 4) NOT NULL,
    "motivo" VARCHAR(255) NOT NULL,
    "registrado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historial_remuneracion_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "historial_remuneracion" IS 'Estructura por vigencia y vínculo. El motor mensual actual obtiene el sueldo de dato_financiero; la integración histórica completa sigue pendiente.';

-- Índices de historial_remuneracion. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (vinculo_laboral_id, vigente_desde): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "uq_remuneracion_vinculo_vigencia" ON "historial_remuneracion" (
    "vinculo_laboral_id",
    "vigente_desde"
);

-- ------------------------------------------------------------------------------------------------
-- 11.3. periodo_vacacional — Períodos vacacionales previstos
-- Estructura para adquisición y saldo de vacaciones. No acredita por sí sola la implementación
-- de la gestión vacacional integral.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "periodo_vacacional" (
    "id" UUID NOT NULL,
    "vinculo_laboral_id" UUID NOT NULL,
    "fecha_desde" DATE NOT NULL,
    "fecha_hasta" DATE NOT NULL,
    "fecha_adquisicion" DATE,
    "fecha_limite_goce" DATE,
    "record_exigido" INTEGER,
    "record_acreditado" INTEGER NOT NULL DEFAULT 0,
    "dias_derecho" INTEGER NOT NULL DEFAULT 0,
    "estado" "estado_periodo_vacacional_enum" NOT NULL DEFAULT 'EN_FORMACION',
    "regla_aplicada" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "periodo_vacacional_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "periodo_vacacional" IS 'Estructura para adquisición y saldo de vacaciones. No acredita por sí sola la implementación de la gestión vacacional integral.';

-- Índices de periodo_vacacional. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (vinculo_laboral_id, fecha_desde): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "uq_periodo_vacacional_vinculo_desde" ON "periodo_vacacional" (
    "vinculo_laboral_id",
    "fecha_desde"
);

-- ------------------------------------------------------------------------------------------------
-- 11.4. vacacion — Eventos vacacionales previstos
-- Estructura para programar y registrar vacaciones; separada de la solicitud administrativa y
-- del resumen de asistencia.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "vacacion" (
    "id" UUID NOT NULL,
    "vinculo_laboral_id" UUID NOT NULL,
    "solicitud_id" UUID,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "dias_calendario" INTEGER NOT NULL,
    "tipo" "tipo_vacacion_enum" NOT NULL DEFAULT 'GOCE',
    "estado" "estado_vacacion_enum" NOT NULL DEFAULT 'PROGRAMADA',
    "acuerdo_url" VARCHAR(255),
    "acuerdo_sha256" CHAR(64),
    "aprobada_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vacacion_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "vacacion" IS 'Estructura para programar y registrar vacaciones; separada de la solicitud administrativa y del resumen de asistencia.';

-- Índices de vacacion. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (solicitud_id): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "vacacion_solicitud_id_key" ON "vacacion" ("solicitud_id");

-- Consulta por (vinculo_laboral_id, fecha_inicio, fecha_fin).

CREATE INDEX "idx_vacacion_vinculo_fechas" ON "vacacion" (
    "vinculo_laboral_id",
    "fecha_inicio",
    "fecha_fin"
);

-- ------------------------------------------------------------------------------------------------
-- 11.5. vacacion_imputacion — Imputación vacacional prevista
-- Relaciona el goce o adelanto con los períodos a los que se aplican sus días.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "vacacion_imputacion" (
    "id" UUID NOT NULL,
    "vacacion_id" UUID NOT NULL,
    "periodo_vacacional_id" UUID NOT NULL,
    "dias" INTEGER NOT NULL,
    CONSTRAINT "vacacion_imputacion_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "vacacion_imputacion" IS 'Relaciona el goce o adelanto con los períodos a los que se aplican sus días.';

-- Índices de vacacion_imputacion. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (vacacion_id, periodo_vacacional_id): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "uq_vacacion_imputacion" ON "vacacion_imputacion" (
    "vacacion_id",
    "periodo_vacacional_id"
);

-- ------------------------------------------------------------------------------------------------
-- 11.6. liquidacion — Cabecera de liquidación prevista
-- Estructura para el cierre económico por cese; la liquidación completa no está implementada en
-- el motor mensual de esta revisión.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "liquidacion" (
    "id" UUID NOT NULL,
    "vinculo_laboral_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fecha_cese" DATE NOT NULL,
    "estado" "estado_planilla_enum" NOT NULL DEFAULT 'ABIERTO',
    "motor_version" VARCHAR(60) NOT NULL,
    "snapshot_calculo" JSONB NOT NULL,
    "total_ingresos" DECIMAL(18, 4) NOT NULL,
    "total_descuentos" DECIMAL(18, 4) NOT NULL,
    "neto_a_pagar" DECIMAL(18, 4) NOT NULL,
    "creada_por_id" UUID NOT NULL,
    "validada_por_id" UUID,
    "validada_en" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "liquidacion_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "liquidacion" IS 'Estructura para el cierre económico por cese; la liquidación completa no está implementada en el motor mensual de esta revisión.';

-- Índices de liquidacion. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (vinculo_laboral_id, version): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "uq_liquidacion_vinculo_version" ON "liquidacion" (
    "vinculo_laboral_id",
    "version"
);

-- ------------------------------------------------------------------------------------------------
-- 11.7. liquidacion_concepto — Detalle de liquidación previsto
-- Conceptos, bases, factores e importes asociados a una liquidación. Requiere sus casos de uso y
-- validaciones específicas.
-- ------------------------------------------------------------------------------------------------

CREATE TABLE "liquidacion_concepto" (
    "id" UUID NOT NULL,
    "liquidacion_id" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "codigo" VARCHAR(60) NOT NULL,
    "naturaleza" "naturaleza_concepto_enum" NOT NULL,
    "descripcion" VARCHAR(200) NOT NULL,
    "base_calculo" DECIMAL(18, 6) NOT NULL,
    "cantidad" DECIMAL(12, 6) NOT NULL,
    "unidad" VARCHAR(30) NOT NULL,
    "factor_aplicado" DECIMAL(18, 8) NOT NULL,
    "monto" DECIMAL(18, 4) NOT NULL,
    "afecto_quinta" BOOLEAN NOT NULL,
    "afecto_onp" BOOLEAN NOT NULL,
    "afecto_afp" BOOLEAN NOT NULL,
    "afecto_essalud" BOOLEAN NOT NULL,
    "computable_cts" BOOLEAN NOT NULL,
    "computable_gratificacion" BOOLEAN NOT NULL,
    "computable_vacaciones" BOOLEAN NOT NULL,
    "codigo_plame" VARCHAR(10),
    "detalle_calculo" JSONB NOT NULL,
    CONSTRAINT "liquidacion_concepto_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "liquidacion_concepto" IS 'Conceptos, bases, factores e importes asociados a una liquidación. Requiere sus casos de uso y validaciones específicas.';

-- Índices de liquidacion_concepto. Las claves primarias se declararon dentro de CREATE TABLE.

-- Unicidad de (liquidacion_id, orden): impide duplicados para esa combinación.

CREATE UNIQUE INDEX "uq_liquidacion_concepto_orden" ON "liquidacion_concepto" ("liquidacion_id", "orden");

-- ================================================================================================
-- 12. RELACIONES Y CLAVES FORÁNEAS
-- ================================================================================================

-- Se añaden después de crear todas las tablas para resolver dependencias entre dominios. ON
-- DELETE/ON UPDATE conservan exactamente la política declarada en Prisma.

-- ------------------------------------------------------------------------------------------------
-- Relaciones de cargo
-- ------------------------------------------------------------------------------------------------

-- cargo(id_area) referencia area(id).

ALTER TABLE "cargo"
ADD CONSTRAINT "fk_cargo_area" FOREIGN KEY ("id_area") REFERENCES "area" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de jornada_area
-- ------------------------------------------------------------------------------------------------

-- jornada_area(jornada_id) referencia jornada(id).

ALTER TABLE "jornada_area"
ADD CONSTRAINT "fk_jornada_area_jornada" FOREIGN KEY ("jornada_id") REFERENCES "jornada" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- jornada_area(area_id) referencia area(id).

ALTER TABLE "jornada_area"
ADD CONSTRAINT "fk_jornada_area_area" FOREIGN KEY ("area_id") REFERENCES "area" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de tipo_afp
-- ------------------------------------------------------------------------------------------------

-- tipo_afp(id_regimen) referencia regimen_pension(id).

ALTER TABLE "tipo_afp"
ADD CONSTRAINT "fk_tipo_afp_regimen" FOREIGN KEY ("id_regimen") REFERENCES "regimen_pension" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de comisiones_afp
-- ------------------------------------------------------------------------------------------------

-- comisiones_afp(afp_id) referencia tipo_afp(id).

ALTER TABLE "comisiones_afp"
ADD CONSTRAINT "fk_comisiones_afp_tipo" FOREIGN KEY ("afp_id") REFERENCES "tipo_afp" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de empleados
-- ------------------------------------------------------------------------------------------------

-- empleados(area_id) referencia area(id).

ALTER TABLE "empleados"
ADD CONSTRAINT "fk_empleado_area" FOREIGN KEY ("area_id") REFERENCES "area" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- empleados(cargo_id) referencia cargo(id).

ALTER TABLE "empleados"
ADD CONSTRAINT "fk_empleado_cargo" FOREIGN KEY ("cargo_id") REFERENCES "cargo" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- empleados(jornada_id) referencia jornada(id).

ALTER TABLE "empleados"
ADD CONSTRAINT "fk_empleado_jornada" FOREIGN KEY ("jornada_id") REFERENCES "jornada" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- empleados(documento_id) referencia tipo_documento(id).

ALTER TABLE "empleados"
ADD CONSTRAINT "fk_empleado_tipo_documento" FOREIGN KEY ("documento_id") REFERENCES "tipo_documento" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de contratos
-- ------------------------------------------------------------------------------------------------

-- contratos(empleado_id) referencia empleados(id).

ALTER TABLE "contratos"
ADD CONSTRAINT "fk_contratos_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- contratos(id_estado) referencia estado_contrato(id).

ALTER TABLE "contratos"
ADD CONSTRAINT "fk_contratos_estado" FOREIGN KEY ("id_estado") REFERENCES "estado_contrato" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- contratos(contrato_origen_id) referencia contratos(id).

ALTER TABLE "contratos"
ADD CONSTRAINT "contratos_contrato_origen_id_fkey" FOREIGN KEY ("contrato_origen_id") REFERENCES "contratos" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de dato_financiero
-- ------------------------------------------------------------------------------------------------

-- dato_financiero(id_banco_sueldo) referencia bancos(id).

ALTER TABLE "dato_financiero"
ADD CONSTRAINT "fk_df_banco_sueldo" FOREIGN KEY ("id_banco_sueldo") REFERENCES "bancos" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- dato_financiero(id_banco_cts) referencia bancos(id).

ALTER TABLE "dato_financiero"
ADD CONSTRAINT "fk_df_banco_cts" FOREIGN KEY ("id_banco_cts") REFERENCES "bancos" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- dato_financiero(empleado_id) referencia empleados(id).

ALTER TABLE "dato_financiero"
ADD CONSTRAINT "fk_dato_financiero_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- dato_financiero(id_regimen) referencia regimen_pension(id).

ALTER TABLE "dato_financiero"
ADD CONSTRAINT "fk_dato_financiero_regimen" FOREIGN KEY ("id_regimen") REFERENCES "regimen_pension" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- dato_financiero(id_tipo_afp) referencia tipo_afp(id).

ALTER TABLE "dato_financiero"
ADD CONSTRAINT "fk_dato_financiero_tipo_afp" FOREIGN KEY ("id_tipo_afp") REFERENCES "tipo_afp" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de derechohabientes
-- ------------------------------------------------------------------------------------------------

-- derechohabientes(empleado_id) referencia empleados(id).

ALTER TABLE "derechohabientes"
ADD CONSTRAINT "fk_dh_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- derechohabientes(documento_id) referencia tipo_documento(id).

ALTER TABLE "derechohabientes"
ADD CONSTRAINT "fk_dh_tipo_doc" FOREIGN KEY ("documento_id") REFERENCES "tipo_documento" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de derechohabiente_documentos
-- ------------------------------------------------------------------------------------------------

-- derechohabiente_documentos(derechohabiente_id) referencia derechohabientes(id).

ALTER TABLE "derechohabiente_documentos"
ADD CONSTRAINT "fk_dhd_derechohabiente" FOREIGN KEY ("derechohabiente_id") REFERENCES "derechohabientes" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de solicitud
-- ------------------------------------------------------------------------------------------------

-- solicitud(empleado_id) referencia empleados(id).

ALTER TABLE "solicitud"
ADD CONSTRAINT "fk_solicitud_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- solicitud(responsable_id) referencia usuarios(id).

ALTER TABLE "solicitud"
ADD CONSTRAINT "fk_solicitud_responsable" FOREIGN KEY ("responsable_id") REFERENCES "usuarios" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de asistencia_marcacion
-- ------------------------------------------------------------------------------------------------

-- asistencia_marcacion(empleado_id) referencia empleados(id).

ALTER TABLE "asistencia_marcacion"
ADD CONSTRAINT "fk_asistencia_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- asistencia_marcacion(usuario_id) referencia usuarios(id).

ALTER TABLE "asistencia_marcacion"
ADD CONSTRAINT "asistencia_marcacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de asistencia_jornada
-- ------------------------------------------------------------------------------------------------

-- asistencia_jornada(empleado_id) referencia empleados(id).

ALTER TABLE "asistencia_jornada"
ADD CONSTRAINT "asistencia_jornada_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleados" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- asistencia_jornada(usuario_id) referencia usuarios(id).

ALTER TABLE "asistencia_jornada"
ADD CONSTRAINT "asistencia_jornada_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- asistencia_jornada(jornada_id) referencia jornada(id).

ALTER TABLE "asistencia_jornada"
ADD CONSTRAINT "asistencia_jornada_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "jornada" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de asistencia_decision
-- ------------------------------------------------------------------------------------------------

-- asistencia_decision(empleado_id) referencia empleados(id).

ALTER TABLE "asistencia_decision"
ADD CONSTRAINT "asistencia_decision_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleados" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- asistencia_decision(usuario_id) referencia usuarios(id).

ALTER TABLE "asistencia_decision"
ADD CONSTRAINT "asistencia_decision_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de asistencia_calendario
-- ------------------------------------------------------------------------------------------------

-- asistencia_calendario(usuario_id) referencia usuarios(id).

ALTER TABLE "asistencia_calendario"
ADD CONSTRAINT "asistencia_calendario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de incidencias_mes
-- ------------------------------------------------------------------------------------------------

-- incidencias_mes(empleado_id) referencia empleados(id).

ALTER TABLE "incidencias_mes"
ADD CONSTRAINT "fk_incidencias_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- incidencias_mes(aprobado_por) referencia usuarios(id).

ALTER TABLE "incidencias_mes"
ADD CONSTRAINT "incidencias_mes_aprobado_por_fkey" FOREIGN KEY ("aprobado_por") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de historial_planillas
-- ------------------------------------------------------------------------------------------------

-- historial_planillas(empleado_id) referencia empleados(id).

ALTER TABLE "historial_planillas"
ADD CONSTRAINT "fk_historial_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- historial_planillas(validado_por) referencia usuarios(id).

ALTER TABLE "historial_planillas"
ADD CONSTRAINT "historial_planillas_validado_por_fkey" FOREIGN KEY ("validado_por") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de novedad_planilla
-- ------------------------------------------------------------------------------------------------

-- novedad_planilla(empleado_id) referencia empleados(id).

ALTER TABLE "novedad_planilla"
ADD CONSTRAINT "novedad_planilla_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleados" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- novedad_planilla(registrado_por) referencia usuarios(id).

ALTER TABLE "novedad_planilla"
ADD CONSTRAINT "novedad_planilla_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuarios" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- novedad_planilla(resuelto_por) referencia usuarios(id).

ALTER TABLE "novedad_planilla"
ADD CONSTRAINT "novedad_planilla_resuelto_por_fkey" FOREIGN KEY ("resuelto_por") REFERENCES "usuarios" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de adelanto_desembolso
-- ------------------------------------------------------------------------------------------------

-- adelanto_desembolso(empleado_id) referencia empleados(id).

ALTER TABLE "adelanto_desembolso"
ADD CONSTRAINT "adelanto_desembolso_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleados" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- adelanto_desembolso(usuario_id) referencia usuarios(id).

ALTER TABLE "adelanto_desembolso"
ADD CONSTRAINT "adelanto_desembolso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- adelanto_desembolso(solicitud_id) referencia solicitud(id).

ALTER TABLE "adelanto_desembolso"
ADD CONSTRAINT "adelanto_desembolso_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de usuarios
-- ------------------------------------------------------------------------------------------------

-- usuarios(empleado_id) referencia empleados(id).

ALTER TABLE "usuarios"
ADD CONSTRAINT "fk_usuarios_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de tokens_seguridad
-- ------------------------------------------------------------------------------------------------

-- tokens_seguridad(usuario_id) referencia usuarios(id).

ALTER TABLE "tokens_seguridad"
ADD CONSTRAINT "fk_tokens_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de audit_log
-- ------------------------------------------------------------------------------------------------

-- audit_log(usuario_id) referencia usuarios(id).

ALTER TABLE "audit_log"
ADD CONSTRAINT "fk_audit_log_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de tareas_asistente
-- ------------------------------------------------------------------------------------------------

-- tareas_asistente(asignado_a) referencia usuarios(id).

ALTER TABLE "tareas_asistente"
ADD CONSTRAINT "fk_tareas_asignado_a" FOREIGN KEY ("asignado_a") REFERENCES "usuarios" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- tareas_asistente(asignado_por) referencia usuarios(id).

ALTER TABLE "tareas_asistente"
ADD CONSTRAINT "fk_tareas_asignado_por" FOREIGN KEY ("asignado_por") REFERENCES "usuarios" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de anotacion_tareas
-- ------------------------------------------------------------------------------------------------

-- anotacion_tareas(tarea_id) referencia tareas_asistente(id).

ALTER TABLE "anotacion_tareas"
ADD CONSTRAINT "fk_anotacion_tareas_tarea" FOREIGN KEY ("tarea_id") REFERENCES "tareas_asistente" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- anotacion_tareas(asignado_por) referencia usuarios(id).

ALTER TABLE "anotacion_tareas"
ADD CONSTRAINT "fk_anotacion_tareas_usuario" FOREIGN KEY ("asignado_por") REFERENCES "usuarios" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de vinculo_laboral
-- ------------------------------------------------------------------------------------------------

-- vinculo_laboral(empleado_id) referencia empleados(id).

ALTER TABLE "vinculo_laboral"
ADD CONSTRAINT "vinculo_laboral_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleados" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de historial_remuneracion
-- ------------------------------------------------------------------------------------------------

-- historial_remuneracion(vinculo_laboral_id) referencia vinculo_laboral(id).

ALTER TABLE "historial_remuneracion"
ADD CONSTRAINT "historial_remuneracion_vinculo_laboral_id_fkey" FOREIGN KEY ("vinculo_laboral_id") REFERENCES "vinculo_laboral" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- historial_remuneracion(registrado_por_id) referencia usuarios(id).

ALTER TABLE "historial_remuneracion"
ADD CONSTRAINT "historial_remuneracion_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de periodo_vacacional
-- ------------------------------------------------------------------------------------------------

-- periodo_vacacional(vinculo_laboral_id) referencia vinculo_laboral(id).

ALTER TABLE "periodo_vacacional"
ADD CONSTRAINT "periodo_vacacional_vinculo_laboral_id_fkey" FOREIGN KEY ("vinculo_laboral_id") REFERENCES "vinculo_laboral" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de vacacion
-- ------------------------------------------------------------------------------------------------

-- vacacion(vinculo_laboral_id) referencia vinculo_laboral(id).

ALTER TABLE "vacacion"
ADD CONSTRAINT "vacacion_vinculo_laboral_id_fkey" FOREIGN KEY ("vinculo_laboral_id") REFERENCES "vinculo_laboral" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- vacacion(solicitud_id) referencia solicitud(id).

ALTER TABLE "vacacion"
ADD CONSTRAINT "vacacion_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- vacacion(aprobada_por_id) referencia usuarios(id).

ALTER TABLE "vacacion"
ADD CONSTRAINT "vacacion_aprobada_por_id_fkey" FOREIGN KEY ("aprobada_por_id") REFERENCES "usuarios" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de vacacion_imputacion
-- ------------------------------------------------------------------------------------------------

-- vacacion_imputacion(vacacion_id) referencia vacacion(id).

ALTER TABLE "vacacion_imputacion"
ADD CONSTRAINT "vacacion_imputacion_vacacion_id_fkey" FOREIGN KEY ("vacacion_id") REFERENCES "vacacion" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- vacacion_imputacion(periodo_vacacional_id) referencia periodo_vacacional(id).

ALTER TABLE "vacacion_imputacion"
ADD CONSTRAINT "vacacion_imputacion_periodo_vacacional_id_fkey" FOREIGN KEY ("periodo_vacacional_id") REFERENCES "periodo_vacacional" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de liquidacion
-- ------------------------------------------------------------------------------------------------

-- liquidacion(vinculo_laboral_id) referencia vinculo_laboral(id).

ALTER TABLE "liquidacion"
ADD CONSTRAINT "liquidacion_vinculo_laboral_id_fkey" FOREIGN KEY ("vinculo_laboral_id") REFERENCES "vinculo_laboral" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- liquidacion(creada_por_id) referencia usuarios(id).

ALTER TABLE "liquidacion"
ADD CONSTRAINT "liquidacion_creada_por_id_fkey" FOREIGN KEY ("creada_por_id") REFERENCES "usuarios" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- liquidacion(validada_por_id) referencia usuarios(id).

ALTER TABLE "liquidacion"
ADD CONSTRAINT "liquidacion_validada_por_id_fkey" FOREIGN KEY ("validada_por_id") REFERENCES "usuarios" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ------------------------------------------------------------------------------------------------
-- Relaciones de liquidacion_concepto
-- ------------------------------------------------------------------------------------------------

-- liquidacion_concepto(liquidacion_id) referencia liquidacion(id).

ALTER TABLE "liquidacion_concepto"
ADD CONSTRAINT "liquidacion_concepto_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "liquidacion" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ================================================================================================
-- 13. FUNCIONES: VALIDACIÓN, CIERRE Y AUDITORÍA
-- ================================================================================================

-- ------------------------------------------------------------------------------------------------
-- 13.1. asistencia_uuid_v7 — Generación de identificadores de auditoría
-- ------------------------------------------------------------------------------------------------

-- Entrada: Sin argumentos.
-- Efecto: Devuelve un UUIDv7 generado con el reloj del servidor SQL y aleatoriedad.
CREATE OR REPLACE FUNCTION asistencia_uuid_v7() RETURNS uuid LANGUAGE plpgsql VOLATILE AS $$
DECLARE azar text := replace(gen_random_uuid()::text, '-', ''); tiempo text;
BEGIN
    tiempo := lpad(to_hex(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint), 12, '0');
    RETURN (tiempo || '7' || substr(azar, 14, 3) || substr(azar, 17, 16))::uuid;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.2. asistencia_exigir_periodo_editable — Verificación de período editable
-- ------------------------------------------------------------------------------------------------

-- Entrada: emp: ID del empleado; mes: período YYYY-MM.
-- Efecto: Bloquea por empleado y rechaza fuentes de una asistencia aprobada o planilla que no
-- esté abierta.
CREATE OR REPLACE FUNCTION asistencia_exigir_periodo_editable(emp uuid, mes text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('asistencia:' || emp::text, 0));
    IF EXISTS (SELECT 1 FROM historial_planillas WHERE empleado_id = emp AND periodo = mes AND upper(estado::text) <> 'ABIERTO') THEN
        RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: la planilla del período % no está abierta.', mes USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM incidencias_mes WHERE empleado_id = emp AND periodo = mes AND estado::text = 'APROBADO') THEN
        RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: reabra la incidencia aprobada del período %.', mes USING ERRCODE = '23514';
    END IF;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.3. asistencia_invalidar — Invalidación de un resumen abierto
-- ------------------------------------------------------------------------------------------------

-- Entrada: emp: ID del empleado; mes: período YYYY-MM.
-- Efecto: Exige período editable, marca vigente=false e incrementa la versión del resumen
-- existente.
CREATE OR REPLACE FUNCTION asistencia_invalidar(emp uuid, mes text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    PERFORM asistencia_exigir_periodo_editable(emp, mes);
    UPDATE incidencias_mes SET vigente = false, version = version + 1, actualizado_en = now() WHERE empleado_id = emp AND periodo = mes;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.4. asistencia_proteger_fuentes — Protección de las fuentes de asistencia
-- ------------------------------------------------------------------------------------------------

-- Entrada: NEW/OLD y operación que recibe el trigger.
-- Efecto: Controla marcas, decisiones, jornadas, calendario y solicitudes; rechaza cambios
-- prohibidos e invalida los resúmenes abiertos afectados.
CREATE OR REPLACE FUNCTION asistencia_proteger_fuentes() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE datos jsonb; anterior jsonb; emp uuid; mes text; desde text; fila record;
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: las fuentes no se borran físicamente.' USING ERRCODE = '23514'; END IF;
    datos := to_jsonb(NEW);
    IF TG_OP = 'UPDATE' THEN anterior := to_jsonb(OLD); END IF;
    emp := (datos->>'empleado_id')::uuid;
    IF TG_TABLE_NAME = 'asistencia_marcacion' THEN
        IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: registre una decisión para corregir la marca original.' USING ERRCODE = '23514'; END IF;
        IF NOT EXISTS (SELECT 1 FROM empleados WHERE id = emp AND deleted_at IS NULL AND fecha_inicio IS NOT NULL
            AND ((datos->>'fecha_hora')::timestamptz AT TIME ZONE 'America/Lima')::date >= fecha_inicio
            AND (fecha_cese IS NULL OR ((datos->>'fecha_hora')::timestamptz AT TIME ZONE 'America/Lima')::date <= fecha_cese)) THEN
            RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: la marca está fuera del vínculo laboral.' USING ERRCODE = '23514';
        END IF;
        mes := to_char((datos->>'fecha_hora')::timestamptz AT TIME ZONE 'America/Lima', 'YYYY-MM');
        PERFORM asistencia_invalidar(emp, mes);
    ELSIF TG_TABLE_NAME = 'asistencia_decision' THEN
        IF TG_OP = 'UPDATE' AND (NEW.empleado_id <> OLD.empleado_id OR NEW.fecha <> OLD.fecha OR NEW.tipo <> OLD.tipo) THEN
            RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: una decisión no puede trasladarse a otro día o colaborador.' USING ERRCODE = '23514';
        END IF;
        PERFORM asistencia_invalidar(emp, substr(datos->>'fecha', 1, 7));
    ELSIF TG_TABLE_NAME = 'solicitud' THEN
        IF datos->>'tipo' NOT IN ('VACACIONES','LICENCIA_MEDICA','PERMISO','JUSTIFICACION_ASISTENCIA') THEN RETURN NEW; END IF;
        IF TG_OP = 'UPDATE' AND (anterior - ARRAY['observacion','responsable_id','updated_at','fecha_limite','sustento_url','sustento_nombre']) = (datos - ARRAY['observacion','responsable_id','updated_at','fecha_limite','sustento_url','sustento_nombre']) THEN RETURN NEW; END IF;
        IF datos->>'fecha_inicio' IS NULL OR datos->>'fecha_fin' IS NULL THEN
            IF datos->>'estado' = 'APROBADA' THEN RAISE EXCEPTION 'La solicitud de asistencia aprobada requiere ambas fechas.' USING ERRCODE = '23514'; END IF;
            RETURN NEW;
        END IF;
        IF (datos->>'fecha_fin')::date - (datos->>'fecha_inicio')::date > 366 THEN RAISE EXCEPTION 'El intervalo excede el alcance de un año.' USING ERRCODE = '23514'; END IF;
        FOR fila IN SELECT DISTINCT to_char(d, 'YYYY-MM') AS periodo FROM generate_series((datos->>'fecha_inicio')::date, (datos->>'fecha_fin')::date, interval '1 day') d ORDER BY 1 LOOP
            PERFORM asistencia_invalidar(emp, fila.periodo);
        END LOOP;
        IF TG_OP = 'UPDATE' AND anterior->>'fecha_inicio' IS NOT NULL AND anterior->>'fecha_fin' IS NOT NULL THEN
            FOR fila IN SELECT DISTINCT to_char(d, 'YYYY-MM') AS periodo FROM generate_series((anterior->>'fecha_inicio')::date, (anterior->>'fecha_fin')::date, interval '1 day') d ORDER BY 1 LOOP
                PERFORM asistencia_invalidar((anterior->>'empleado_id')::uuid, fila.periodo);
            END LOOP;
        END IF;
    ELSIF TG_TABLE_NAME = 'asistencia_jornada' THEN
        IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'La asignación histórica se conserva; registre otra vigencia.' USING ERRCODE = '23514'; END IF;
        PERFORM pg_advisory_xact_lock(hashtextextended('asistencia:' || emp::text, 0));
        FOR fila IN SELECT periodo FROM incidencias_mes WHERE empleado_id = emp AND periodo >= substr(datos->>'desde', 1, 7)
            UNION SELECT periodo FROM historial_planillas WHERE empleado_id = emp AND periodo >= substr(datos->>'desde', 1, 7) ORDER BY periodo LOOP
            PERFORM asistencia_invalidar(emp, fila.periodo);
        END LOOP;
    ELSIF TG_TABLE_NAME = 'asistencia_calendario' THEN
        IF TG_OP = 'UPDATE' AND NEW.fecha <> OLD.fecha THEN RAISE EXCEPTION 'No se puede trasladar un descanso a otra fecha.' USING ERRCODE = '23514'; END IF;
        mes := substr(datos->>'fecha', 1, 7);
        FOR fila IN SELECT empleado_id FROM incidencias_mes WHERE periodo = mes UNION SELECT empleado_id FROM historial_planillas WHERE periodo = mes ORDER BY empleado_id LOOP
            PERFORM asistencia_invalidar(fila.empleado_id, mes);
        END LOOP;
    END IF;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.5. asistencia_proteger_resumen — Protección del resumen mensual
-- ------------------------------------------------------------------------------------------------

-- Entrada: Fila de incidencias_mes recibida por el trigger.
-- Efecto: Impide borrado físico y cambios indebidos sobre aprobados; admite la reapertura
-- explícita y motivada prevista.
CREATE OR REPLACE FUNCTION asistencia_proteger_resumen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'El resumen de asistencia no se elimina físicamente.' USING ERRCODE = '23514'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('asistencia:' || NEW.empleado_id::text, 0));
    IF EXISTS (SELECT 1 FROM historial_planillas WHERE empleado_id = NEW.empleado_id AND periodo = NEW.periodo AND upper(estado::text) <> 'ABIERTO') THEN
        RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: la planilla del resumen no está abierta.' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado::text = 'APROBADO' THEN
        IF NEW.estado::text <> 'PENDIENTE' OR NEW.vigente OR NEW.motivo_revision IS NULL OR length(trim(NEW.motivo_revision)) < 5 OR NEW.aprobado_por IS NOT NULL THEN
            RAISE EXCEPTION 'ASISTENCIA_BLOQUEADA: solo se admite una reapertura explícita y motivada.' USING ERRCODE = '23514';
        END IF;
        IF (to_jsonb(NEW) - ARRAY['estado','vigente','version','motivo_revision','aprobado_por','aprobado_en','actualizado_en']) <> (to_jsonb(OLD) - ARRAY['estado','vigente','version','motivo_revision','aprobado_por','aprobado_en','actualizado_en']) THEN
            RAISE EXCEPTION 'No se puede alterar el cálculo durante la reapertura.' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.6. proteger_planilla_congelada — Inmutabilidad y requisitos de cierre
-- ------------------------------------------------------------------------------------------------

-- Entrada: Fila de historial_planillas recibida por el trigger.
-- Efecto: Impide borrar el historial o alterar un cierre. Exige contador activo, instantánea y
-- asistencia aprobada coherente antes de congelar.
CREATE OR REPLACE FUNCTION proteger_planilla_congelada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE incidencia incidencias_mes; rol_actor text;
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'PLANILLA_BLOQUEADA: no se permite borrar el historial.' USING ERRCODE = '23514'; END IF;
    IF TG_OP = 'UPDATE' AND upper(OLD.estado::text) IN ('CONGELADO','DECLARADO') THEN
        RAISE EXCEPTION 'PLANILLA_BLOQUEADA: el período % es inmutable.', OLD.periodo USING ERRCODE = '23514';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('asistencia:' || NEW.empleado_id::text, 0));
    IF upper(NEW.estado::text) IN ('CONGELADO','DECLARADO') THEN
        SELECT * INTO incidencia FROM incidencias_mes WHERE empleado_id = NEW.empleado_id AND periodo = NEW.periodo;
        SELECT rol::text INTO rol_actor FROM usuarios WHERE id = NEW.validado_por AND activo AND deleted_at IS NULL;
        IF rol_actor <> 'CONTADOR' OR rol_actor IS NULL OR NEW.snapshot_calculo IS NULL OR NEW.fuente_hash IS NULL OR NEW.validado_en IS NULL THEN
            RAISE EXCEPTION 'PLANILLA_BLOQUEADA: falta validación del contador o instantánea del cálculo.' USING ERRCODE = '23514';
        END IF;
        IF incidencia.estado::text <> 'APROBADO' OR NOT incidencia.vigente OR NOT incidencia.completo OR incidencia.pendientes <> 0 OR NEW.incidencia_version IS DISTINCT FROM incidencia.version OR incidencia.id IS NULL THEN
            RAISE EXCEPTION 'PLANILLA_BLOQUEADA: la asistencia aprobada cambió o está incompleta.' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.7. asistencia_auditar — Auditoría en la misma transacción
-- ------------------------------------------------------------------------------------------------

-- Entrada: Fila afectada y contexto local app.usuario_id/app.ip.
-- Efecto: Inserta valores antes/después en audit_log. En planillas evita duplicar la instantánea
-- completa.
CREATE OR REPLACE FUNCTION asistencia_auditar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE antes jsonb; despues jsonb; actor uuid; ip inet;
BEGIN
    actor := nullif(current_setting('app.usuario_id', true), '')::uuid;
    ip := coalesce(nullif(current_setting('app.ip', true), ''), '127.0.0.1')::inet;
    IF TG_OP = 'UPDATE' THEN antes := to_jsonb(OLD); END IF;
    despues := to_jsonb(NEW);
    --La auditoría del historial conserva metadatos y montos, sin duplicar el documento de cálculo completo.
    IF TG_TABLE_NAME = 'historial_planillas' THEN antes := antes - 'snapshot_calculo'; despues := despues - 'snapshot_calculo'; END IF;
    INSERT INTO audit_log(id, usuario_id, accion, tabla_afectada, registro_id, valores_antes, valores_despues, direccion_ip)
        VALUES(asistencia_uuid_v7(), actor, CASE WHEN TG_OP = 'INSERT' THEN 'CREATE' ELSE TG_OP END, TG_TABLE_NAME, NEW.id, antes, despues, ip);
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.8. payroll_proteger_desembolso — Integridad de la entrega de un adelanto
-- ------------------------------------------------------------------------------------------------

-- Entrada: Fila de adelanto_desembolso recibida por el trigger.
-- Efecto: Admite el alta una sola vez y exige solicitud aprobada, mismo beneficiario y mismo
-- importe; protege períodos cerrados.
CREATE OR REPLACE FUNCTION payroll_proteger_desembolso() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pedido solicitud;
BEGIN
    IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'PLANILLA_BLOQUEADA: el desembolso conserva la entrega original.' USING ERRCODE = '23514'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('asistencia:' || NEW.empleado_id::text, 0));
    IF EXISTS (SELECT 1 FROM historial_planillas WHERE empleado_id = NEW.empleado_id AND periodo = NEW.periodo_descuento AND upper(estado::text) <> 'ABIERTO') THEN
        RAISE EXCEPTION 'PLANILLA_BLOQUEADA: no puede agregarse un desembolso a ese período.' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO pedido FROM solicitud WHERE id = NEW.solicitud_id;
    IF pedido.id IS NULL OR pedido.tipo::text <> 'ADELANTO_SUELDO' OR pedido.estado::text <> 'APROBADA' OR pedido.empleado_id <> NEW.empleado_id OR pedido.monto <> NEW.monto THEN
        RAISE EXCEPTION 'El desembolso debe corresponder al monto y colaborador de un adelanto aprobado.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.9. asistencia_proteger_vinculo — Control de cambios del vínculo
-- ------------------------------------------------------------------------------------------------

-- Entrada: Fila anterior y nueva de empleados.
-- Efecto: Comprueba cambios de fechas de ingreso/cese contra los resúmenes y planillas que
-- resultarían afectados.
CREATE OR REPLACE FUNCTION asistencia_proteger_vinculo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE inicio date; fila record;
BEGIN
    IF NEW.fecha_inicio IS NOT DISTINCT FROM OLD.fecha_inicio AND NEW.fecha_cese IS NOT DISTINCT FROM OLD.fecha_cese THEN RETURN NEW; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('asistencia:' || NEW.id::text, 0));
    IF NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio THEN inicio := least(NEW.fecha_inicio, OLD.fecha_inicio);
    ELSE inicio := least(NEW.fecha_cese, OLD.fecha_cese); END IF;
    FOR fila IN SELECT periodo FROM incidencias_mes WHERE empleado_id = NEW.id AND periodo >= coalesce(to_char(inicio, 'YYYY-MM'), '0000-01')
        UNION SELECT periodo FROM historial_planillas WHERE empleado_id = NEW.id AND periodo >= coalesce(to_char(inicio, 'YYYY-MM'), '0000-01') ORDER BY periodo LOOP
        PERFORM asistencia_invalidar(NEW.id, fila.periodo);
    END LOOP;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.10. asistencia_invalidar_acumulado_medico — Invalidación por cambio médico anual
-- ------------------------------------------------------------------------------------------------

-- Entrada: Solicitud médica y su intervalo de fechas.
-- Efecto: Revisa períodos posteriores del ejercicio porque el acumulado médico de meses previos
-- puede afectar su evaluación.
CREATE OR REPLACE FUNCTION asistencia_invalidar_acumulado_medico() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE fila record; primero text; ultimo text;
BEGIN
    IF TG_OP = 'INSERT' AND (NEW.tipo::text <> 'LICENCIA_MEDICA' OR NEW.fecha_inicio IS NULL) THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND NEW.tipo::text <> 'LICENCIA_MEDICA' AND OLD.tipo::text <> 'LICENCIA_MEDICA' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - ARRAY['observacion','responsable_id','updated_at','fecha_limite','sustento_url','sustento_nombre']) = (to_jsonb(OLD) - ARRAY['observacion','responsable_id','updated_at','fecha_limite','sustento_url','sustento_nombre']) THEN RETURN NEW; END IF;
    primero := to_char(NEW.fecha_inicio, 'YYYY-MM'); ultimo := to_char(coalesce(NEW.fecha_fin, NEW.fecha_inicio), 'YYYY') || '-12';
    IF TG_OP = 'UPDATE' THEN
        primero := least(primero, to_char(OLD.fecha_inicio, 'YYYY-MM'));
        ultimo := greatest(ultimo, to_char(coalesce(OLD.fecha_fin, OLD.fecha_inicio), 'YYYY') || '-12');
    END IF;
    FOR fila IN SELECT periodo FROM incidencias_mes WHERE empleado_id = NEW.empleado_id AND periodo BETWEEN primero AND ultimo
        UNION SELECT periodo FROM historial_planillas WHERE empleado_id = NEW.empleado_id AND periodo BETWEEN primero AND ultimo ORDER BY periodo LOOP
        PERFORM asistencia_invalidar(NEW.empleado_id, fila.periodo);
    END LOOP;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.11. payroll_proteger_novedad — Protección del concepto variable y su visado
-- ------------------------------------------------------------------------------------------------

-- Entrada: Fila de novedad_planilla recibida por el trigger.
-- Efecto: Conserva el concepto original, exige contador activo para resolver y bloquea cambios
-- incompatibles con el cierre.
CREATE OR REPLACE FUNCTION payroll_proteger_novedad() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'PLANILLA_BLOQUEADA: las novedades se conservan para auditoría.' USING ERRCODE = '23514'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('asistencia:' || NEW.empleado_id::text, 0));
    IF EXISTS (SELECT 1 FROM historial_planillas WHERE empleado_id = NEW.empleado_id AND periodo = NEW.periodo AND upper(estado::text) <> 'ABIERTO') THEN
        RAISE EXCEPTION 'PLANILLA_BLOQUEADA: no se puede cambiar una novedad de ese período.' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - ARRAY['estado','resuelto_por','motivo_resolucion','version','updated_at']) <> (to_jsonb(OLD) - ARRAY['estado','resuelto_por','motivo_resolucion','version','updated_at']) THEN
        RAISE EXCEPTION 'La novedad original se conserva; anule y registre una nueva si debe corregirla.' USING ERRCODE = '23514';
    END IF;
    IF NEW.estado <> 'PENDIENTE' AND (NEW.resuelto_por IS NULL OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id = NEW.resuelto_por AND rol::text = 'CONTADOR' AND activo AND deleted_at IS NULL)) THEN
        RAISE EXCEPTION 'La resolución de una novedad corresponde a un contador activo.' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado <> 'PENDIENTE' AND NOT (OLD.estado = 'APROBADO' AND NEW.estado = 'ANULADO') THEN
        RAISE EXCEPTION 'La novedad ya está resuelta.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.12. payroll_validar_parametro — Control de vigencias de parámetros
-- ------------------------------------------------------------------------------------------------

-- Entrada: Código, valor e intervalo del parámetro.
-- Efecto: Serializa por código y rechaza valores negativos, intervalos invertidos y
-- superposición con otra vigencia.
CREATE OR REPLACE FUNCTION payroll_validar_parametro() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('parametro:' || NEW.codigo, 0));
    IF NEW.valor < 0 OR NEW.vigente_hasta < NEW.vigente_desde THEN
        RAISE EXCEPTION 'Parámetro negativo o fechas invertidas.' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM parametro_legal p WHERE p.codigo = NEW.codigo AND p.id <> NEW.id
        AND p.vigente_desde <= coalesce(NEW.vigente_hasta, 'infinity'::date)
        AND coalesce(p.vigente_hasta, 'infinity'::date) >= NEW.vigente_desde) THEN
        RAISE EXCEPTION 'Las vigencias del parámetro % se superponen.', NEW.codigo USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------------------------
-- 13.13. payroll_validar_comision — Control de tasas y vigencias AFP
-- ------------------------------------------------------------------------------------------------

-- Entrada: AFP, porcentajes, tope e intervalo de comisión.
-- Efecto: Serializa por AFP y rechaza tasas/rangos inválidos o intervalos que se superponen.
CREATE OR REPLACE FUNCTION payroll_validar_comision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('afp:' || NEW.afp_id::text, 0));
    IF NEW.periodo_final < NEW.periodo_inicio OR NEW.aporte_obligatorio NOT BETWEEN 0 AND 100
        OR NEW.prima_seguro NOT BETWEEN 0 AND 100 OR NEW.comision_sobre_ra NOT BETWEEN 0 AND 100
        OR NEW.comision_mixta NOT BETWEEN 0 AND 100 OR NEW.comision_flujo_mixta NOT BETWEEN 0 AND 100
        OR NEW.remuneracion_maxima_asegurable <= 0 THEN
        RAISE EXCEPTION 'Tasa, tope o vigencia AFP inválidos.' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM comisiones_afp c WHERE c.afp_id = NEW.afp_id AND c.id <> NEW.id
        AND c.periodo_inicio <= coalesce(NEW.periodo_final, 'infinity'::date)
        AND coalesce(c.periodo_final, 'infinity'::date) >= NEW.periodo_inicio) THEN
        RAISE EXCEPTION 'Las vigencias AFP se superponen.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

-- ================================================================================================
-- 14. TRIGGERS: TABLAS Y MOMENTOS DE EJECUCIÓN
-- ================================================================================================

-- Las funciones anteriores definen las reglas. Estos triggers indican qué escritura las activa.
-- DROP TRIGGER IF EXISTS permite reinstalar la vinculación sin duplicarla.

DROP TRIGGER IF EXISTS trg_proteger_planilla ON historial_planillas;

-- ------------------------------------------------------------------------------------------------
-- trg_proteger_planilla en historial_planillas
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before insert or update or delete por fila y llama a proteger_planilla_congelada.

CREATE TRIGGER trg_proteger_planilla BEFORE INSERT OR UPDATE OR DELETE ON historial_planillas FOR EACH ROW EXECUTE FUNCTION proteger_planilla_congelada();

-- ------------------------------------------------------------------------------------------------
-- Triggers compartidos de fuentes y auditoría
-- ------------------------------------------------------------------------------------------------

-- El primer bucle protege marcas, decisiones, jornadas, calendario y solicitudes antes de
-- escribir. El segundo audita marcas, decisiones, jornadas, calendario, resúmenes y planillas
-- después de insertar/actualizar. Cada trigger pertenece a su tabla aunque comparta nombre.

DO $$ DECLARE tabla text; BEGIN
    FOREACH tabla IN ARRAY ARRAY['asistencia_marcacion','asistencia_decision','asistencia_jornada','asistencia_calendario','solicitud'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_asistencia_fuentes ON %I', tabla);
        EXECUTE format('CREATE TRIGGER trg_asistencia_fuentes BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION asistencia_proteger_fuentes()', tabla);
    END LOOP;
    FOREACH tabla IN ARRAY ARRAY['asistencia_marcacion','asistencia_decision','asistencia_jornada','asistencia_calendario','incidencias_mes','historial_planillas'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_asistencia_auditoria ON %I', tabla);
        EXECUTE format('CREATE TRIGGER trg_asistencia_auditoria AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION asistencia_auditar()', tabla);
    END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_asistencia_resumen ON incidencias_mes;

-- ------------------------------------------------------------------------------------------------
-- trg_asistencia_resumen en incidencias_mes
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before insert or update or delete por fila y llama a asistencia_proteger_resumen.

CREATE TRIGGER trg_asistencia_resumen BEFORE INSERT OR UPDATE OR DELETE ON incidencias_mes FOR EACH ROW EXECUTE FUNCTION asistencia_proteger_resumen();

DROP TRIGGER IF EXISTS trg_payroll_desembolso ON adelanto_desembolso;

-- ------------------------------------------------------------------------------------------------
-- trg_payroll_desembolso en adelanto_desembolso
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before insert or update or delete por fila y llama a payroll_proteger_desembolso.

CREATE TRIGGER trg_payroll_desembolso BEFORE INSERT OR UPDATE OR DELETE ON adelanto_desembolso FOR EACH ROW EXECUTE FUNCTION payroll_proteger_desembolso();

DROP TRIGGER IF EXISTS trg_asistencia_auditoria ON adelanto_desembolso;

-- ------------------------------------------------------------------------------------------------
-- trg_asistencia_auditoria en adelanto_desembolso
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta after insert por fila y llama a asistencia_auditar.

CREATE TRIGGER trg_asistencia_auditoria AFTER INSERT ON adelanto_desembolso FOR EACH ROW EXECUTE FUNCTION asistencia_auditar();

DROP TRIGGER IF EXISTS trg_asistencia_vinculo ON empleados;

-- ------------------------------------------------------------------------------------------------
-- trg_asistencia_vinculo en empleados
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before update por fila y llama a asistencia_proteger_vinculo.

CREATE TRIGGER trg_asistencia_vinculo BEFORE UPDATE ON empleados FOR EACH ROW EXECUTE FUNCTION asistencia_proteger_vinculo();

DROP TRIGGER IF EXISTS trg_asistencia_medico_anual ON solicitud;

-- ------------------------------------------------------------------------------------------------
-- trg_asistencia_medico_anual en solicitud
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before insert or update por fila y llama a asistencia_invalidar_acumulado_medico.

CREATE TRIGGER trg_asistencia_medico_anual BEFORE INSERT OR UPDATE ON solicitud FOR EACH ROW EXECUTE FUNCTION asistencia_invalidar_acumulado_medico();

DROP TRIGGER IF EXISTS trg_payroll_novedad ON novedad_planilla;

-- ------------------------------------------------------------------------------------------------
-- trg_payroll_novedad en novedad_planilla
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before insert or update or delete por fila y llama a payroll_proteger_novedad.

CREATE TRIGGER trg_payroll_novedad BEFORE INSERT OR UPDATE OR DELETE ON novedad_planilla FOR EACH ROW EXECUTE FUNCTION payroll_proteger_novedad();

DROP TRIGGER IF EXISTS trg_asistencia_auditoria ON novedad_planilla;

-- ------------------------------------------------------------------------------------------------
-- trg_asistencia_auditoria en novedad_planilla
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta after insert or update por fila y llama a asistencia_auditar.

CREATE TRIGGER trg_asistencia_auditoria AFTER INSERT OR UPDATE ON novedad_planilla FOR EACH ROW EXECUTE FUNCTION asistencia_auditar();

DROP TRIGGER IF EXISTS trg_solicitud_auditoria_atomica ON solicitud;

-- ------------------------------------------------------------------------------------------------
-- trg_solicitud_auditoria_atomica en solicitud
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta after insert or update por fila y llama a asistencia_auditar.

CREATE TRIGGER trg_solicitud_auditoria_atomica AFTER INSERT OR UPDATE ON solicitud FOR EACH ROW EXECUTE FUNCTION asistencia_auditar();

DROP TRIGGER IF EXISTS trg_parametro_vigencia ON parametro_legal;

-- ------------------------------------------------------------------------------------------------
-- trg_parametro_vigencia en parametro_legal
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before insert or update por fila y llama a payroll_validar_parametro.

CREATE TRIGGER trg_parametro_vigencia BEFORE INSERT OR UPDATE ON parametro_legal FOR EACH ROW EXECUTE FUNCTION payroll_validar_parametro();

DROP TRIGGER IF EXISTS trg_comision_vigencia ON comisiones_afp;

-- ------------------------------------------------------------------------------------------------
-- trg_comision_vigencia en comisiones_afp
-- ------------------------------------------------------------------------------------------------

-- Se ejecuta before insert or update por fila y llama a payroll_validar_comision.

CREATE TRIGGER trg_comision_vigencia BEFORE INSERT OR UPDATE ON comisiones_afp FOR EACH ROW EXECUTE FUNCTION payroll_validar_comision();

-- ================================================================================================
-- 15. RESTRICCIONES ADICIONALES Y UNICIDAD CONDICIONAL
-- ================================================================================================

-- Estos CHECK expresan reglas que Prisma no representa en el schema. NOT VALID conserva la
-- instalación sobre históricos pendientes de revisar, pero sí exige cumplimiento a nuevas
-- escrituras. El índice parcial permite un solo descuento DSO aprobado por empleado/período.

-- ------------------------------------------------------------------------------------------------
-- 15.1. Reglas del resumen mensual, horario y solicitudes
-- ------------------------------------------------------------------------------------------------
DO $$ BEGIN
    -- ck_jornada_minutos_regulares: Cota del dato almacenado: de 1 a 2880 minutos semanales. El
    -- motor comprueba además la distribución y duración diaria del horario regular.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_jornada_minutos_regulares' AND conrelid = 'asistencia_jornada'::regclass) THEN
        ALTER TABLE asistencia_jornada ADD CONSTRAINT ck_jornada_minutos_regulares CHECK (minutos_semana BETWEEN 1 AND 2880) NOT VALID;
    END IF;
    -- ck_incidencia_aprobada_verificada: APROBADO exige resumen vigente y completo, cero pendientes,
    -- huella de fuentes y usuario aprobador.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_incidencia_aprobada_verificada' AND conrelid = 'incidencias_mes'::regclass) THEN
        ALTER TABLE incidencias_mes ADD CONSTRAINT ck_incidencia_aprobada_verificada CHECK (estado::text <> 'APROBADO' OR (vigente AND completo AND pendientes = 0 AND fuente_hash IS NOT NULL AND aprobado_por IS NOT NULL)) NOT VALID;
    END IF;
    -- ck_solicitud_horas: Permiso parcial: las horas se informan juntas, usan HH:mm, mantienen orden
    -- y corresponden a la misma fecha.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_solicitud_horas' AND conrelid = 'solicitud'::regclass) THEN
        ALTER TABLE solicitud ADD CONSTRAINT ck_solicitud_horas CHECK ((hora_inicio IS NULL AND hora_fin IS NULL) OR (hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_inicio ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND hora_fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND fecha_inicio = fecha_fin AND hora_inicio < hora_fin)) NOT VALID;
    END IF;
    -- ck_solicitud_efecto: Limita los efectos a PENDIENTE_DEFINIR, CON_GOCE, SIN_GOCE y SUBSIDIO; el
    -- caso de uso resuelve su compatibilidad con el trámite.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_solicitud_efecto' AND conrelid = 'solicitud'::regclass) THEN
        ALTER TABLE solicitud ADD CONSTRAINT ck_solicitud_efecto CHECK (efecto_asistencia IN ('PENDIENTE_DEFINIR','CON_GOCE','SIN_GOCE','SUBSIDIO')) NOT VALID;
    END IF;
END $$;

-- Prisma no representa estos CHECK; el generador los añade a la instalación completa.
-- ------------------------------------------------------------------------------------------------
-- 15.2. Reglas de decisiones, jornada, novedades y desembolsos
-- ------------------------------------------------------------------------------------------------
DO $restricciones$
DECLARE regla record;
BEGIN
    FOR regla IN SELECT * FROM (VALUES
        -- ck_decision_tipo: La decisión diaria corresponde a AUSENCIA, MARCACIONES o SOBRETIEMPO.
        ('asistencia_decision','ck_decision_tipo', $$tipo IN ('AUSENCIA','MARCACIONES','SOBRETIEMPO')$$),
        -- ck_decision_motivo: El motivo de una decisión conserva al menos cinco caracteres después de
        -- quitar espacios extremos.
        ('asistencia_decision','ck_decision_motivo', 'length(trim(motivo)) >= 5'),
        -- ck_jornada_tolerancia: La tolerancia configurada se mantiene entre cero y sesenta minutos.
        ('asistencia_jornada','ck_jornada_tolerancia', 'tolerancia_minutos BETWEEN 0 AND 60'),
        -- ck_jornada_politica: La política de descuento de tardanza debe ser COMPLETA o EXCESO.
        ('asistencia_jornada','ck_jornada_politica', $$politica_tolerancia IN ('COMPLETA','EXCESO')$$),
        -- ck_jornada_motivo: La asignación histórica requiere un motivo de al menos cinco caracteres
        -- útiles.
        ('asistencia_jornada','ck_jornada_motivo', 'length(trim(motivo)) >= 5'),
        -- ck_novedad_monto: Un concepto variable no puede registrar un importe negativo.
        ('novedad_planilla','ck_novedad_monto', 'monto >= 0'),
        -- ck_novedad_tipo: Se admiten los tres conceptos implementados: bono extraordinario
        -- remunerativo, descuento autorizado y descuento DSO.
        ('novedad_planilla','ck_novedad_tipo', $$tipo IN ('BONO_EXTRAORDINARIO_REMUNERATIVO','DESCUENTO_AUTORIZADO','DESCUENTO_DSO')$$),
        -- ck_novedad_estado: Los estados de visado son PENDIENTE, APROBADO, RECHAZADO y ANULADO.
        ('novedad_planilla','ck_novedad_estado', $$estado IN ('PENDIENTE','APROBADO','RECHAZADO','ANULADO')$$),
        -- ck_desembolso_positivo: La entrega efectiva de un adelanto debe tener un importe mayor que
        -- cero.
        ('adelanto_desembolso','ck_desembolso_positivo', 'monto > 0')
    ) AS reglas(tabla,nombre,expresion) LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=regla.nombre AND conrelid=to_regclass(regla.tabla)) THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%s) NOT VALID', regla.tabla, regla.nombre, regla.expresion);
        END IF;
    END LOOP;
END $restricciones$;

-- Un solo ajuste de descanso semanal obligatorio aprobado por colaborador y período.
-- ------------------------------------------------------------------------------------------------
-- 15.3. Una novedad DSO aprobada por empleado y período
-- ------------------------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_novedad_dso_aprobada ON novedad_planilla (empleado_id, periodo)
WHERE
    tipo = 'DESCUENTO_DSO'
    AND estado = 'APROBADO';

-- ================================================================================================
-- 16. VERSIÓN INSTALADA Y CONFIRMACIÓN
-- ================================================================================================

-- ------------------------------------------------------------------------------------------------
-- 16.1. asistencia_version_migracion — Marca de la instalación SQL
-- ------------------------------------------------------------------------------------------------

-- Entrada: Sin argumentos.
-- Efecto: Devuelve la revisión instalada. Se define al final; el arranque comprueba también que
-- los triggers críticos estén activos.
CREATE OR REPLACE FUNCTION asistencia_version_migracion() RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '2026-10-21.1'::text $$;

COMMIT;