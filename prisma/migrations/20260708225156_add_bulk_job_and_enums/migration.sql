/*
  Warnings:

  - The `estado` column on the `carga_masiva_jobs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `estado_sincronizacion` column on the `empleados` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "estado_job_enum" AS ENUM ('EN_COLA', 'PROCESANDO', 'COMPLETADO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "estado_sincronizacion_enum" AS ENUM ('COMPLETO', 'BORRADOR');

-- AlterTable
ALTER TABLE "carga_masiva_jobs" DROP COLUMN "estado",
ADD COLUMN     "estado" "estado_job_enum" NOT NULL DEFAULT 'EN_COLA';

-- AlterTable
ALTER TABLE "empleados" ALTER COLUMN "nombre" DROP NOT NULL,
ALTER COLUMN "apellido" DROP NOT NULL,
DROP COLUMN "estado_sincronizacion",
ADD COLUMN     "estado_sincronizacion" "estado_sincronizacion_enum" NOT NULL DEFAULT 'COMPLETO';
