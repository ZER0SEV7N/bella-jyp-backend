/*
  Warnings:

  - You are about to drop the `aportaciones` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `empleado` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `estado_empleado` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "estado_empleado_enum" AS ENUM ('ACTIVO', 'VACACIONES', 'LICENCIA', 'CESADO', 'DESPEDIDO', 'SUSPENDIDO');

-- DropForeignKey
ALTER TABLE "aportaciones" DROP CONSTRAINT "fk_aportaciones_afp";

-- DropForeignKey
ALTER TABLE "asistencia_marcacion" DROP CONSTRAINT "fk_asistencia_empleado";

-- DropForeignKey
ALTER TABLE "contratos" DROP CONSTRAINT "fk_contratos_empleado";

-- DropForeignKey
ALTER TABLE "dato_financiero" DROP CONSTRAINT "fk_dato_financiero_empleado";

-- DropForeignKey
ALTER TABLE "derechohabientes" DROP CONSTRAINT "fk_dh_empleado";

-- DropForeignKey
ALTER TABLE "empleado" DROP CONSTRAINT "fk_empleado_area";

-- DropForeignKey
ALTER TABLE "empleado" DROP CONSTRAINT "fk_empleado_cargo";

-- DropForeignKey
ALTER TABLE "empleado" DROP CONSTRAINT "fk_empleado_estado";

-- DropForeignKey
ALTER TABLE "empleado" DROP CONSTRAINT "fk_empleado_jornada";

-- DropForeignKey
ALTER TABLE "empleado" DROP CONSTRAINT "fk_empleado_tipo_documento";

-- DropForeignKey
ALTER TABLE "historial_planillas" DROP CONSTRAINT "fk_historial_empleado";

-- DropForeignKey
ALTER TABLE "incidencias_mes" DROP CONSTRAINT "fk_incidencias_empleado";

-- DropForeignKey
ALTER TABLE "solicitud" DROP CONSTRAINT "fk_solicitud_empleado";

-- DropForeignKey
ALTER TABLE "usuarios" DROP CONSTRAINT "fk_usuarios_empleado";

-- AlterTable
ALTER TABLE "comisiones_afp" ALTER COLUMN "aporte_obligatorio" SET DEFAULT 10.0000;

-- AlterTable
ALTER TABLE "contratos" ALTER COLUMN "url" DROP NOT NULL;

-- AlterTable
ALTER TABLE "historial_planillas" ADD COLUMN     "bonif_extraordinaria" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
ADD COLUMN     "descuento_adelanto" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
ADD COLUMN     "descuento_eps" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
ADD COLUMN     "descuento_faltas" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
ADD COLUMN     "descuento_onp" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
ADD COLUMN     "descuento_tardanzas" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
ADD COLUMN     "dias_laborados" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "gratificacion" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
ALTER COLUMN "tasa_afp_aplicada" DROP NOT NULL;

-- AlterTable
ALTER TABLE "solicitud" ADD COLUMN     "monto" DECIMAL(12,4);

-- DropTable
DROP TABLE "aportaciones";

-- DropTable
DROP TABLE "empleado";

-- DropTable
DROP TABLE "estado_empleado";

-- CreateTable
CREATE TABLE "parametro_legal" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "valor" DECIMAL(12,4) NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE,
    "descripcion" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parametro_legal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleados" (
    "id" UUID NOT NULL,
    "cargo_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,
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
    "fecha_inicio" DATE,
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

-- CreateIndex
CREATE INDEX "idx_parametro_busqueda" ON "parametro_legal"("codigo", "vigente_desde", "vigente_hasta");

-- CreateIndex
CREATE UNIQUE INDEX "uq_parametro_codigo_vigencia" ON "parametro_legal"("codigo", "vigente_desde");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_nro_documento_key" ON "empleados"("nro_documento");

-- CreateIndex
CREATE INDEX "idx_empleado_activo" ON "empleados"("activo") WHERE (activo = true);

-- CreateIndex
CREATE INDEX "idx_empleado_estado_laboral" ON "empleados"("estado_laboral");

-- CreateIndex
CREATE INDEX "idx_empleado_area" ON "empleados"("area_id");

-- CreateIndex
CREATE INDEX "idx_empleado_cargo" ON "empleados"("cargo_id");

-- CreateIndex
CREATE INDEX "idx_empleado_deleted" ON "empleados"("deleted_at") WHERE (deleted_at IS NULL);

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "fk_empleado_area" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "fk_empleado_cargo" FOREIGN KEY ("cargo_id") REFERENCES "cargo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "fk_empleado_jornada" FOREIGN KEY ("jornada_id") REFERENCES "jornada"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "fk_empleado_tipo_documento" FOREIGN KEY ("documento_id") REFERENCES "tipo_documento"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "fk_contratos_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dato_financiero" ADD CONSTRAINT "fk_dato_financiero_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "derechohabientes" ADD CONSTRAINT "fk_dh_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asistencia_marcacion" ADD CONSTRAINT "fk_asistencia_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "incidencias_mes" ADD CONSTRAINT "fk_incidencias_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "fk_solicitud_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historial_planillas" ADD CONSTRAINT "fk_historial_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "fk_usuarios_empleado" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
