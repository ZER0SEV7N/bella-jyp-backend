-- CreateEnum
CREATE TYPE "estado_planilla_enum" AS ENUM ('abierto', 'en_revision', 'congelado', 'declarado');

-- CreateEnum
CREATE TYPE "estado_tarea_enum" AS ENUM ('pendiente', 'revision', 'aprobado');

-- CreateEnum
CREATE TYPE "rol_usuario_enum" AS ENUM ('ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE', 'EMPLEADO');

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

    CONSTRAINT "area_pkey" PRIMARY KEY ("id")
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
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comisiones_afp" (
    "id" UUID NOT NULL,
    "afp_id" UUID NOT NULL,
    "periodo" VARCHAR(50) NOT NULL,
    "aporte_obligatorio" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "comision_sobre_ra" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "prima_seguro" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "comision_mixta" DECIMAL(6,4) NOT NULL DEFAULT 0,

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

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dato_financiero" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "id_regimen" UUID NOT NULL,
    "id_tipo_afp" UUID,
    "id_banco" UUID,
    "cuenta_bancaria" VARCHAR(30),
    "sueldo_basico" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "cuspp" VARCHAR(20),
    "tipo_comision" VARCHAR(50),
    "nro_cuenta_sueldo" VARCHAR(30),
    "cci" VARCHAR(30),
    "banco_cts" VARCHAR(50),
    "nro_cuenta_cts" VARCHAR(30),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "dato_financiero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleados" (
    "id" UUID NOT NULL,
    "cargo_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,
    "estado_empleado_id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,
    "nro_documento" VARCHAR(20) NOT NULL,
    "fecha_nacimiento" DATE,
    "fecha_inicio" DATE,
    "fecha_cese" DATE,
    "afp_fecha_filiacion" DATE,
    "asig_familiar" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empleados_pkey" PRIMARY KEY ("id")
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
    "estado" "estado_planilla_enum" NOT NULL DEFAULT 'abierto',
    "comentarios" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "historial_planillas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regimen_pension" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "regimen_pension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas_asistente" (
    "id" UUID NOT NULL,
    "asignado_a" UUID NOT NULL,
    "asignado_por" UUID NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "fecha_entrega" DATE,
    "estado" "estado_tarea_enum" NOT NULL DEFAULT 'pendiente',
    "anotaciones" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tareas_asistente_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE INDEX "idx_audit_log_fecha" ON "audit_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_log_tabla" ON "audit_log"("tabla_afectada");

-- CreateIndex
CREATE INDEX "idx_audit_log_usuario" ON "audit_log"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_cargo_area" ON "cargo"("id_area");

-- CreateIndex
CREATE INDEX "idx_contratos_deleted" ON "contratos"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_contratos_empleado" ON "contratos"("empleado_id");

-- CreateIndex
CREATE UNIQUE INDEX "dato_financiero_empleado_id_key" ON "dato_financiero"("empleado_id");

-- CreateIndex
CREATE INDEX "idx_dato_fin_empleado" ON "dato_financiero"("empleado_id");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_nro_documento_key" ON "empleados"("nro_documento");

-- CreateIndex
CREATE INDEX "idx_empleados_activo" ON "empleados"("activo") WHERE (activo = true);

-- CreateIndex
CREATE INDEX "idx_empleados_area" ON "empleados"("area_id");

-- CreateIndex
CREATE INDEX "idx_empleados_cargo" ON "empleados"("cargo_id");

-- CreateIndex
CREATE INDEX "idx_empleados_deleted" ON "empleados"("deleted_at") WHERE (deleted_at IS NULL);

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
CREATE INDEX "idx_tipo_afp_regimen" ON "tipo_afp"("id_regimen");

-- CreateIndex
CREATE INDEX "idx_tokens_activos" ON "tokens_seguridad"("id") WHERE (usado = false);

-- CreateIndex
CREATE INDEX "idx_tokens_usuario" ON "tokens_seguridad"("usuario_id", "proposito");

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

-- AddForeignKey
ALTER TABLE "anotacion_tareas" ADD CONSTRAINT "fk_anotacion_tareas_tarea" FOREIGN KEY ("tarea_id") REFERENCES "tareas_asistente"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "anotacion_tareas" ADD CONSTRAINT "fk_anotacion_tareas_usuario" FOREIGN KEY ("asignado_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "aportaciones" ADD CONSTRAINT "fk_aportaciones_afp" FOREIGN KEY ("afp_id") REFERENCES "tipo_afp"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "fk_audit_log_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cargo" ADD CONSTRAINT "fk_cargo_area" FOREIGN KEY ("id_area") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comisiones_afp" ADD CONSTRAINT "fk_comisiones_afp_tipo" FOREIGN KEY ("afp_id") REFERENCES "tipo_afp"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "fk_contratos_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "fk_contratos_estado" FOREIGN KEY ("id_estado") REFERENCES "estado_contrato"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dato_financiero" ADD CONSTRAINT "fk_dato_financiero_banco" FOREIGN KEY ("id_banco") REFERENCES "bancos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dato_financiero" ADD CONSTRAINT "fk_dato_financiero_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dato_financiero" ADD CONSTRAINT "fk_dato_financiero_regimen" FOREIGN KEY ("id_regimen") REFERENCES "regimen_pension"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dato_financiero" ADD CONSTRAINT "fk_dato_financiero_tipo_afp" FOREIGN KEY ("id_tipo_afp") REFERENCES "tipo_afp"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "fk_empleados_area" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "fk_empleados_cargo" FOREIGN KEY ("cargo_id") REFERENCES "cargo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "fk_empleados_estado" FOREIGN KEY ("estado_empleado_id") REFERENCES "estado_empleado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "fk_empleados_tipo_documento" FOREIGN KEY ("documento_id") REFERENCES "tipo_documento"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historial_planillas" ADD CONSTRAINT "fk_historial_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tareas_asistente" ADD CONSTRAINT "fk_tareas_asignado_a" FOREIGN KEY ("asignado_a") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tareas_asistente" ADD CONSTRAINT "fk_tareas_asignado_por" FOREIGN KEY ("asignado_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tipo_afp" ADD CONSTRAINT "fk_tipo_afp_regimen" FOREIGN KEY ("id_regimen") REFERENCES "regimen_pension"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tokens_seguridad" ADD CONSTRAINT "fk_tokens_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "fk_usuarios_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
