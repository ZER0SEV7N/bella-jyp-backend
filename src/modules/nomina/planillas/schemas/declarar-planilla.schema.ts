//src/modules/nomina/planillas/schemas/declarar-planilla.schema.ts
import { z } from 'zod';

/**
 * Cuerpo de `POST /api/v1/nomina/planillas/:id/declarar` (PLA-F3).
 * Confirma la versión de la planilla y permite un motivo opcional para auditoría.
 */
export const DeclararPlanillaSchema = z.object({
  version: z.number().int().positive(),
  motivo: z.string().trim().min(5).max(1000).optional(),
});

export type DeclararPlanillaDto = z.infer<typeof DeclararPlanillaSchema>;
