-- Migración: bandeja de salida de integraciones (INT-F3) y motivo de cese (D3).
--
-- Contexto:
--  * `IntegracionTrabajo` existía en prisma/schema.prisma pero en ninguna migración. En una base
--    nueva, cualquier exportación a n8n fallaba con Prisma P2021 (tabla inexistente) y respondía 500.
--  * `empleados.motivo_cese` se usa al registrar el cese; se agrega aquí para que el esquema físico
--    quede alineado con el modelo Prisma.
--
-- Nota para futuras migraciones: el índice parcial `uq_novedad_dso_aprobada` no está modelado en
-- Prisma. No debe eliminarse al regenerar diferencias.

BEGIN;

-- 1. Enum de estado del trabajo de integración.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_integracion_enum') THEN
        CREATE TYPE "estado_integracion_enum" AS ENUM ('PARCIAL', 'PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'FALLIDO');
    END IF;
END $$;

-- 2. Bandeja de salida persistente para n8n.
CREATE TABLE IF NOT EXISTS "integracion_trabajo" (
    "id" UUID NOT NULL,
    "clave" VARCHAR(200) NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "estado" "estado_integracion_enum" NOT NULL DEFAULT 'PENDIENTE',
    "periodo" VARCHAR(7),
    "usuario_id" UUID,
    "solicitud_cifrada" TEXT NOT NULL,
    "planilla_ids" UUID[] NOT NULL,
    "resultado" JSONB,
    "error" VARCHAR(2000),
    "ejecucion_id" UUID,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "despachado_en" TIMESTAMPTZ(6),
    "iniciado_en" TIMESTAMPTZ(6),
    "finalizado_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "integracion_trabajo_pkey" PRIMARY KEY ("id")
);

-- 3. Índices: idempotencia, cola pendiente y consulta por período.
CREATE UNIQUE INDEX IF NOT EXISTS "integracion_trabajo_clave_key" ON "integracion_trabajo" ("clave");
CREATE INDEX IF NOT EXISTS "idx_integracion_pendiente" ON "integracion_trabajo" ("estado", "despachado_en");
CREATE INDEX IF NOT EXISTS "idx_integracion_periodo" ON "integracion_trabajo" ("periodo", "tipo");
CREATE INDEX IF NOT EXISTS "integracion_trabajo_usuario_id_idx" ON "integracion_trabajo" ("usuario_id");

-- 4. Clave foránea al usuario que solicitó el trabajo (puede ser NULL en trabajos automáticos).
ALTER TABLE "integracion_trabajo" DROP CONSTRAINT IF EXISTS "integracion_trabajo_usuario_id_fkey";
ALTER TABLE "integracion_trabajo"
    ADD CONSTRAINT "integracion_trabajo_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

-- 5. Motivo de cese: se conserva para auditoría y para la liquidación.
ALTER TABLE "empleados" ADD COLUMN IF NOT EXISTS "motivo_cese" VARCHAR(255);

COMMIT;
