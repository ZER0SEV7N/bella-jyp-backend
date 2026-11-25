//src/modules/core/usuarios/schemas/usuarios.schema.ts
import { z } from 'zod';

/**
 * Contratos de entrada del módulo de usuarios (USR-F2).
 *
 * Se declaran en el backend porque `@jyp/shared-contracts` se consume como dependencia Git:
 * un cambio local en ese repositorio no llega al runtime hasta publicarlo. Cuando se libere la
 * versión correspondiente, estos esquemas se mueven al paquete compartido sin cambiar el contrato.
 */

/** Roles válidos del sistema; debe coincidir con `rol_usuario_enum` de Prisma. */
export const RolUsuarioSchema = z.enum([
  'JYP',
  'ADMIN',
  'CONTADOR',
  'RRHH',
  'ASISTENTE',
  'EMPLEADO',
]);

export type RolUsuario = z.infer<typeof RolUsuarioSchema>;

/**
 * Filtros de `GET /api/v1/core/usuarios`.
 * Los parámetros de query llegan como texto, por eso `page` y `limit` se coercionan a número
 * y `activo` se limita a `"true"` / `"false"` (un valor arbitrario ya no llega a Prisma).
 */
export const ListarUsuariosQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  rol: RolUsuarioSchema.optional(),
  activo: z
    .enum(['true', 'false'])
    .transform((valor) => valor === 'true')
    .optional(),
  search: z.string().trim().max(100).optional(),
});

export type ListarUsuariosQuery = z.infer<typeof ListarUsuariosQuerySchema>;

/** Cuerpo de `PATCH /api/v1/core/usuarios/:id/estado`. */
export const CambiarEstadoUsuarioSchema = z.object({
  activo: z.boolean(),
});

export type CambiarEstadoUsuarioBody = z.infer<
  typeof CambiarEstadoUsuarioSchema
>;

/** Cuerpo de `PATCH /api/v1/core/usuarios/:id/rol`. */
export const CambiarRolUsuarioSchema = z.object({
  rol: RolUsuarioSchema,
});

export type CambiarRolUsuarioBody = z.infer<typeof CambiarRolUsuarioSchema>;
