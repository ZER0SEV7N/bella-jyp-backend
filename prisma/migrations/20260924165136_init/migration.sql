-- CreateEnum
CREATE TYPE "duracion_jornada_enum" AS ENUM ('TIEMPO_COMPLETO', 'TIEMPO_PARCIAL');

-- CreateEnum
CREATE TYPE "turno_jornada_enum" AS ENUM ('MANANA', 'TARDE', 'NOCHE', 'MIXTO', 'ROTATIVO');

-- CreateEnum
CREATE TYPE "modalidad_jornada_enum" AS ENUM ('PRESENCIAL', 'REMOTO', 'HIBRIDO');

-- CreateEnum
CREATE TYPE "estado_planilla_enum" AS ENUM ('ABIERTO', 'EN_REVISION', 'CONGELADO', 'DECLARADO');

-- CreateEnum
CREATE TYPE "estado_tarea_enum" AS ENUM ('PENDIENTE', 'REVISION', 'APROBADO', 'RECHAZADO', 'AUDITADO');

-- CreateEnum
CREATE TYPE "rol_usuario_enum" AS ENUM ('ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE', 'EMPLEADO', 'JYP');

-- CreateEnum
CREATE TYPE "estado_job_enum" AS ENUM ('EN_COLA', 'PROCESANDO', 'COMPLETADO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "estado_sincronizacion_enum" AS ENUM ('COMPLETO', 'BORRADOR');

-- CreateEnum
CREATE TYPE "tipo_marcacion_enum" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "estado_incidencia_enum" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "TipoSolicitud" AS ENUM ('VACACIONES', 'LICENCIA_MEDICA', 'PERMISO', 'JUSTIFICACION_ASISTENCIA', 'ACTUALIZACION_DATOS', 'ADELANTO_SUELDO', 'RENUNCIA');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "tipo_cuenta_bancaria_enum" AS ENUM ('SUELDO', 'AHORROS', 'CORRIENTE');

-- CreateEnum
CREATE TYPE "regimen_salud_enum" AS ENUM ('ESSALUD_REGULAR', 'EPS', 'ESSALUD_Y_EPS', 'SCTR');

-- CreateEnum
CREATE TYPE "vinculo_familiar_enum" AS ENUM ('CONYUGE', 'CONCUBINO', 'HIJO_MENOR', 'HIJO_MAYOR_INCAPACITADO', 'HIJO_MAYOR_ESTUDIANTE', 'MADRE_GESTANTE');

-- CreateEnum
CREATE TYPE "estado_civil_enum" AS ENUM ('SOLTERO', 'CASADO', 'CONVIVIENTE', 'DIVORCIADO', 'VIUDO');

-- CreateEnum
CREATE TYPE "sexo_enum" AS ENUM ('MASCULINO', 'FEMENINO');

-- CreateEnum
CREATE TYPE "tipo_sustento_familiar_enum" AS ENUM ('PARTIDA_NACIMIENTO', 'PARTIDA_MATRIMONIO', 'ESCRITURA_CONCUBINATO', 'DNI_DERECHOHABIENTE', 'CONSTANCIA_ESTUDIOS', 'CERTIFICADO_INCAPACIDAD', 'OTRO');

-- CreateTable
CREATE TABLE "anotacion_tareas" (
    "id" UUID NOT NULL,
    "tarea_id" UUID NOT NULL,
    "asignado_por" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anotacion_tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aportaciones" (
    "id" UUID NOT NULL,
    "afp_id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "cantidad" DECIMAL(12,4) NOT NULL DEFAULT 0,

    CONSTRAINT "aportaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "tipo_afp" (
    "id" UUID NOT NULL,
    "id_regimen" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "tipo_afp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_documento" (
    "id" UUID NOT NULL,
    "tipo_documento" VARCHAR(100) NOT NULL,

    CONSTRAINT "tipo_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bancos" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "bancos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargo" (
    "id" UUID NOT NULL,
    "id_area" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "sueldo_minimo" DECIMAL(12,4) DEFAULT 1130.00,
    "sueldo_maximo" DECIMAL(12,4),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estado_contrato" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "estado_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estado_empleado" (
    "id" UUID NOT NULL,
    "descripcion" VARCHAR(100) NOT NULL,

    CONSTRAINT "estado_empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regimen_pension" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "regimen_pension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comisiones_afp" (
    "id" UUID NOT NULL,
    "afp_id" UUID NOT NULL,
    "aporte_obligatorio" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "comision_sobre_ra" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "prima_seguro" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "comision_mixta" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "periodo_final" DATE,
    "periodo_inicio" DATE NOT NULL,

    CONSTRAINT "comisiones_afp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "id_estado" UUID NOT NULL,
    "tipo_modalidad" VARCHAR(100),
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "renovado" BOOLEAN NOT NULL DEFAULT false,
    "observacion" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" VARCHAR(225) NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dato_financiero" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "id_regimen" UUID NOT NULL,
    "id_tipo_afp" UUID,
    "sueldo_basico" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "cuspp" VARCHAR(20),
    "tipo_comision" VARCHAR(50),
    "id_banco_sueldo" UUID,
    "tipo_cuenta_sueldo" "tipo_cuenta_bancaria_enum" NOT NULL DEFAULT 'SUELDO',
    "nro_cuenta_sueldo" VARCHAR(255),
    "cci_sueldo" VARCHAR(255),
    "id_banco_cts" UUID,
    "tipo_cuenta_cts" "tipo_cuenta_bancaria_enum" NOT NULL DEFAULT 'AHORROS',
    "nro_cuenta_cts" VARCHAR(255),
    "cci_cts" VARCHAR(255),
    "regimen_salud" "regimen_salud_enum" NOT NULL DEFAULT 'ESSALUD_REGULAR',
    "eps_nombre" VARCHAR(100),
    "eps_plan" VARCHAR(100),
    "eps_costo_adicional" DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dato_financiero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "empleado" (
    "id" UUID NOT NULL,
    "cargo_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,
    "estado_empleado_id" UUID NOT NULL,
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
    "fecha_inicio" DATE,
    "fecha_cese" DATE,
    "afp_fecha_filiacion" DATE,
    "asig_familiar" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jornada_id" UUID,
    "estado_sincronizacion" "estado_sincronizacion_enum" NOT NULL DEFAULT 'COMPLETO',

    CONSTRAINT "empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_planillas" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "sueldo_base" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "asignacion_familia" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "horas_extras_25" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "horas_extras_35" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "recargo_nocturno" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "descuento_afp_fondo" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "descuento_afp_seguro" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "descuento_afp_comision" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "descuento_quinta" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "tasa_afp_aplicada" DECIMAL(6,4) NOT NULL,
    "aporte_essalud" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "total_ingresos" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "total_descuentos" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "neto_a_pagar" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "estado" "estado_planilla_enum" NOT NULL DEFAULT 'ABIERTO',
    "comentarios" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "historial_planillas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "accion" VARCHAR(100) NOT NULL,
    "tabla_afectada" VARCHAR(100) NOT NULL,
    "registro_id" UUID NOT NULL,
    "valores_antes" JSONB,
    "valores_despues" JSONB,
    "direccion_ip" INET NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jornada" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "duracion" "duracion_jornada_enum" NOT NULL DEFAULT 'TIEMPO_COMPLETO',
    "turno" "turno_jornada_enum" NOT NULL DEFAULT 'MANANA',
    "modalidad" "modalidad_jornada_enum" NOT NULL DEFAULT 'PRESENCIAL',
    "tolerancia_minutos" INTEGER NOT NULL DEFAULT 5,
    "total_horas_semana" DECIMAL(5,2) NOT NULL DEFAULT 40.00,
    "horario_semanal" JSONB NOT NULL,
    "patron_rotacion" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jornada_area" (
    "jornada_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,

    CONSTRAINT "jornada_area_pkey" PRIMARY KEY ("jornada_id","area_id")
);

-- CreateTable
CREATE TABLE "asistencia_marcacion" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "fecha_hora" TIMESTAMPTZ(6) NOT NULL,
    "tipo_marcacion" "tipo_marcacion_enum" NOT NULL,
    "metodo" VARCHAR(50) NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asistencia_marcacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidencias_mes" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "dias_trabajados" INTEGER NOT NULL DEFAULT 0,
    "faltas" INTEGER NOT NULL DEFAULT 0,
    "minutos_tardanza" INTEGER NOT NULL DEFAULT 0,
    "horas_extras_25" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "horas_extras_35" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "estado" "estado_incidencia_enum" NOT NULL DEFAULT 'PENDIENTE',
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidencias_mes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "empleado_id" UUID NOT NULL,
    "tipo" "TipoSolicitud" NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_inicio" DATE,
    "fecha_fin" DATE,
    "dias_solicitados" INTEGER DEFAULT 1,
    "motivo" TEXT NOT NULL,
    "observacion" TEXT,
    "sustento_url" VARCHAR(255),
    "sustento_nombre" VARCHAR(150),
    "responsable_id" UUID,
    "fecha_limite" DATE,
    "origen" VARCHAR(50) NOT NULL DEFAULT 'PORTAL_EMPLEADO',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE INDEX "idx_area_nombre" ON "area"("nombre");

-- CreateIndex
CREATE INDEX "idx_area_activo" ON "area"("activo") WHERE (activo = true);

-- CreateIndex
CREATE INDEX "idx_area_deleted" ON "area"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_tipo_afp_regimen" ON "tipo_afp"("id_regimen");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_documento_tipo_documento_key" ON "tipo_documento"("tipo_documento");

-- CreateIndex
CREATE INDEX "idx_cargo_area" ON "cargo"("id_area");

-- CreateIndex
CREATE INDEX "idx_cargo_activo" ON "cargo"("activo") WHERE (activo = true);

-- CreateIndex
CREATE INDEX "idx_cargo_deleted" ON "cargo"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "estado_empleado_descripcion_key" ON "estado_empleado"("descripcion");

-- CreateIndex
CREATE INDEX "idx_comisiones_afp_fechas" ON "comisiones_afp"("afp_id", "periodo_inicio");

-- CreateIndex
CREATE INDEX "idx_contratos_deleted" ON "contratos"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_contratos_empleado" ON "contratos"("empleado_id");

-- CreateIndex
CREATE UNIQUE INDEX "dato_financiero_empleado_id_key" ON "dato_financiero"("empleado_id");

-- CreateIndex
CREATE INDEX "idx_dato_fin_empleado" ON "dato_financiero"("empleado_id");

-- CreateIndex
CREATE UNIQUE INDEX "empleado_nro_documento_key" ON "empleado"("nro_documento");

-- CreateIndex
CREATE INDEX "idx_empleado_activo" ON "empleado"("activo") WHERE (activo = true);

-- CreateIndex
CREATE INDEX "idx_empleado_area" ON "empleado"("area_id");

-- CreateIndex
CREATE INDEX "idx_empleado_cargo" ON "empleado"("cargo_id");

-- CreateIndex
CREATE INDEX "idx_empleado_deleted" ON "empleado"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_planilla_periodo_estado" ON "historial_planillas"("periodo", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "uq_empleado_periodo" ON "historial_planillas"("empleado_id", "periodo");

-- CreateIndex
CREATE INDEX "idx_tareas_asignado_a" ON "tareas_asistente"("asignado_a");

-- CreateIndex
CREATE INDEX "idx_tareas_deleted" ON "tareas_asistente"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_tareas_estado" ON "tareas_asistente"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_empleado_id_key" ON "usuarios"("empleado_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "idx_usuarios_activo" ON "usuarios"("activo") WHERE (activo = true);

-- CreateIndex
CREATE INDEX "idx_usuarios_deleted" ON "usuarios"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_usuarios_email" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "idx_usuarios_empleado" ON "usuarios"("empleado_id");

-- CreateIndex
CREATE INDEX "idx_tokens_activos" ON "tokens_seguridad"("id") WHERE (usado = false);

-- CreateIndex
CREATE INDEX "idx_tokens_usuario" ON "tokens_seguridad"("usuario_id", "proposito");

-- CreateIndex
CREATE INDEX "idx_audit_log_fecha" ON "audit_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_log_tabla" ON "audit_log"("tabla_afectada");

-- CreateIndex
CREATE INDEX "idx_audit_log_usuario" ON "audit_log"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_jornada_activo" ON "jornada"("activo") WHERE (activo = true);

-- CreateIndex
CREATE INDEX "idx_jornada_modalidad" ON "jornada"("modalidad");

-- CreateIndex
CREATE INDEX "idx_jornada_turno" ON "jornada"("turno");

-- CreateIndex
CREATE INDEX "idx_jornada_duracion" ON "jornada"("duracion");

-- CreateIndex
CREATE INDEX "idx_jornada_area_area" ON "jornada_area"("area_id");

-- CreateIndex
CREATE INDEX "idx_asistencia_emp_fecha" ON "asistencia_marcacion"("empleado_id", "fecha_hora");

-- CreateIndex
CREATE UNIQUE INDEX "uq_incidencia_periodo" ON "incidencias_mes"("empleado_id", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_codigo_key" ON "solicitud"("codigo");

-- CreateIndex
CREATE INDEX "idx_solicitud_empleado" ON "solicitud"("empleado_id");

-- CreateIndex
CREATE INDEX "idx_solicitud_estado" ON "solicitud"("estado");

-- CreateIndex
CREATE INDEX "idx_solicitud_tipo" ON "solicitud"("tipo");

-- CreateIndex
CREATE INDEX "idx_dh_empleado" ON "derechohabientes"("empleado_id");

-- CreateIndex
CREATE INDEX "idx_dh_activo" ON "derechohabientes"("activo") WHERE (activo = true);

-- CreateIndex
CREATE INDEX "idx_dh_deleted" ON "derechohabientes"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "uq_empleado_derechohabiente" ON "derechohabientes"("empleado_id", "nro_documento");

-- CreateIndex
CREATE INDEX "idx_dhd_derechohabiente" ON "derechohabiente_documentos"("derechohabiente_id");

-- CreateIndex
CREATE INDEX "idx_dhd_vigente" ON "derechohabiente_documentos"("vigente") WHERE (vigente = true);

-- CreateIndex
CREATE INDEX "idx_dhd_vencimiento" ON "derechohabiente_documentos"("fecha_vencimiento");

-- AddForeignKey
ALTER TABLE "anotacion_tareas" ADD CONSTRAINT "fk_anotacion_tareas_tarea" FOREIGN KEY ("tarea_id") REFERENCES "tareas_asistente"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "anotacion_tareas" ADD CONSTRAINT "fk_anotacion_tareas_usuario" FOREIGN KEY ("asignado_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "aportaciones" ADD CONSTRAINT "fk_aportaciones_afp" FOREIGN KEY ("afp_id") REFERENCES "tipo_afp"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tipo_afp" ADD CONSTRAINT "fk_tipo_afp_regimen" FOREIGN KEY ("id_regimen") REFERENCES "regimen_pension"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cargo" ADD CONSTRAINT "fk_cargo_area" FOREIGN KEY ("id_area") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comisiones_afp" ADD CONSTRAINT "fk_comisiones_afp_tipo" FOREIGN KEY ("afp_id") REFERENCES "tipo_afp"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "fk_contratos_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "fk_contratos_estado" FOREIGN KEY ("id_estado") REFERENCES "estado_contrato"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dato_financiero" ADD CONSTRAINT "fk_df_banco_sueldo" FOREIGN KEY ("id_banco_sueldo") REFERENCES "bancos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dato_financiero" ADD CONSTRAINT "fk_df_banco_cts" FOREIGN KEY ("id_banco_cts") REFERENCES "bancos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dato_financiero" ADD CONSTRAINT "fk_dato_financiero_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dato_financiero" ADD CONSTRAINT "fk_dato_financiero_regimen" FOREIGN KEY ("id_regimen") REFERENCES "regimen_pension"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dato_financiero" ADD CONSTRAINT "fk_dato_financiero_tipo_afp" FOREIGN KEY ("id_tipo_afp") REFERENCES "tipo_afp"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "fk_empleado_area" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "fk_empleado_cargo" FOREIGN KEY ("cargo_id") REFERENCES "cargo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "fk_empleado_estado" FOREIGN KEY ("estado_empleado_id") REFERENCES "estado_empleado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "fk_empleado_jornada" FOREIGN KEY ("jornada_id") REFERENCES "jornada"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "fk_empleado_tipo_documento" FOREIGN KEY ("documento_id") REFERENCES "tipo_documento"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historial_planillas" ADD CONSTRAINT "fk_historial_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tareas_asistente" ADD CONSTRAINT "fk_tareas_asignado_a" FOREIGN KEY ("asignado_a") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tareas_asistente" ADD CONSTRAINT "fk_tareas_asignado_por" FOREIGN KEY ("asignado_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "fk_usuarios_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tokens_seguridad" ADD CONSTRAINT "fk_tokens_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "fk_audit_log_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "jornada_area" ADD CONSTRAINT "fk_jornada_area_jornada" FOREIGN KEY ("jornada_id") REFERENCES "jornada"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "jornada_area" ADD CONSTRAINT "fk_jornada_area_area" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asistencia_marcacion" ADD CONSTRAINT "fk_asistencia_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "incidencias_mes" ADD CONSTRAINT "fk_incidencias_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "fk_solicitud_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "fk_solicitud_responsable" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "derechohabientes" ADD CONSTRAINT "fk_dh_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "derechohabientes" ADD CONSTRAINT "fk_dh_tipo_doc" FOREIGN KEY ("documento_id") REFERENCES "tipo_documento"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "derechohabiente_documentos" ADD CONSTRAINT "fk_dhd_derechohabiente" FOREIGN KEY ("derechohabiente_id") REFERENCES "derechohabientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
