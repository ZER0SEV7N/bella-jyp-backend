-- Migración: auditoría de la declaración de planillas (PLA-F3).
--
-- Contexto:
--  * La planilla pasa CONGELADO -> DECLARADO al declararse (cierre del mes). Para conservar
--    quién y cuándo la declaró (sin pisar `validado_por`/`validado_en`, que registran el
--    congelamiento), se agregan dos columnas opcionales.

BEGIN;

ALTER TABLE "historial_planillas" ADD COLUMN IF NOT EXISTS "declarado_por" UUID;
ALTER TABLE "historial_planillas" ADD COLUMN IF NOT EXISTS "declarado_en" TIMESTAMPTZ(6);

COMMIT;
