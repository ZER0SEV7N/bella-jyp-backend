//src/modules/nomina/planillas/schemas/listar-novedades-globales.schema.ts
import { z } from 'zod';

/**
 * Filtros de `GET /api/v1/nomina/planillas/novedades` (PLA-F5).
 * Permite al contador ver las novedades de todos los colaboradores de un período,
 * con filtro opcional por empleado y estado, y paginación.
 */
export const ListarNovedadesGlobalesQuerySchema = z.object({
  empleado_id: z.uuid().optional(),
  periodo: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'El período debe tener el formato YYYY-MM.')
    .optional(),
  estado: z
    .enum(['PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO'])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListarNovedadesGlobalesQuery = z.infer<
  typeof ListarNovedadesGlobalesQuerySchema
>;
