//src/modules/core/audit/contracts/actividad-auditoria.schema.ts
//Contrato de la vista asistida de auditoría (`/core/audit/actividad` y `/core/audit/afectados`).
//No importa nada del backend: puede moverse tal cual a `@jyp/shared-contracts`.
import { z } from 'zod';

/** Tipos de entidad de negocio a los que se atribuye un cambio auditado. */
export const TIPOS_AFECTADO_AUDITORIA = [
  'empleado',
  'area',
  'cargo',
  'jornada',
  'empresa',
] as const;

/** Tipos de afectado que tienen ID y por eso admiten una línea de tiempo propia. */
export const TIPOS_AFECTADO_CON_ID_AUDITORIA = [
  'empleado',
  'area',
  'cargo',
  'jornada',
] as const;

/** Acciones de negocio que se muestran a RRHH. */
export const ACCIONES_VISTA_AUDITORIA = [
  'CREACION',
  'EDICION',
  'BAJA',
  'REACTIVACION',
  'ELIMINACION',
] as const;

/** Tipos de dato de un campo de negocio. */
export const TIPOS_CAMPO_AUDITORIA = [
  'texto',
  'fecha',
  'fecha_hora',
  'hora',
  'booleano',
  'moneda',
  'numero',
  'enum',
  'referencia',
  'lista',
] as const;

/** Fecha de calendario `YYYY-MM-DD` que existe de verdad (rechaza `2026-02-31`). */
const FechaCalendarioSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use el formato AAAA-MM-DD.')
  .refine((valor) => {
    const fecha = new Date(`${valor}T00:00:00.000Z`);
    return (
      !Number.isNaN(fecha.getTime()) &&
      fecha.toISOString().slice(0, 10) === valor
    );
  }, 'La fecha no existe en el calendario.');

const PaginacionSchema = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
};

/** Query de `GET /api/v1/core/audit/actividad`: mismos filtros que `/logs` más el afectado. */
export const ActividadAuditoriaQuerySchema = z
  .object({
    ...PaginacionSchema,
    tabla_afectada: z.string().max(100).optional(),
    accion: z.string().max(100).optional(),
    usuario_id: z.string().uuid().optional(),
    registro_id: z.string().uuid().optional(),
    afectado_tipo: z.enum(TIPOS_AFECTADO_AUDITORIA).optional(),
    afectado_id: z.string().uuid().optional(),
    desde: FechaCalendarioSchema.optional(),
    hasta: FechaCalendarioSchema.optional(),
  })
  .refine((q) => !q.desde || !q.hasta || q.desde <= q.hasta, {
    message: '`desde` no puede ser posterior a `hasta`.',
    path: ['hasta'],
  });
export type ActividadAuditoriaQueryDto = z.output<
  typeof ActividadAuditoriaQuerySchema
>;

/** Query de `GET /api/v1/core/audit/afectados/:tipo/:id`. */
export const LineaTiempoAfectadoQuerySchema = z
  .object({
    page: PaginacionSchema.page,
    limit: z.coerce.number().int().positive().max(100).default(20),
    desde: FechaCalendarioSchema.optional(),
    hasta: FechaCalendarioSchema.optional(),
  })
  .refine((q) => !q.desde || !q.hasta || q.desde <= q.hasta, {
    message: '`desde` no puede ser posterior a `hasta`.',
    path: ['hasta'],
  });
export type LineaTiempoAfectadoQueryDto = z.output<
  typeof LineaTiempoAfectadoQuerySchema
>;

/** Parámetros de ruta de `GET /api/v1/core/audit/afectados/:tipo/:id`. */
export const AfectadoParamsSchema = z.object({
  tipo: z.enum(TIPOS_AFECTADO_CON_ID_AUDITORIA),
  id: z.string().uuid(),
});
export type AfectadoParamsDto = z.output<typeof AfectadoParamsSchema>;

/** Parámetros de ruta de `GET /api/v1/core/audit/actividad/:id`. */
export const ActividadIdParamsSchema = z.object({ id: z.string().uuid() });
export type ActividadIdParamsDto = z.output<typeof ActividadIdParamsSchema>;

/** Valor ya legible de un campo: texto, número, Sí/No o `null` si no tiene valor. */
export const ValorCambioAuditoriaSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const CambioElementoSchema = z.object({
  campo: z.string(),
  etiqueta: z.string(),
  tipo: z.enum(TIPOS_CAMPO_AUDITORIA),
  antes: ValorCambioAuditoriaSchema,
  despues: ValorCambioAuditoriaSchema,
});

/** Elemento de una lista (por ejemplo un día del horario) que cambió, con sus campos. */
export const DetalleElementoAuditoriaSchema = z.object({
  elemento: z.string(),
  etiqueta: z.string(),
  cambios: z.array(CambioElementoSchema),
});

/** Un campo que cambió, con sus valores ya traducidos a lenguaje de negocio. */
export const CambioActividadAuditoriaSchema = CambioElementoSchema.extend({
  protegido: z.boolean().optional(),
  detalle: z.array(DetalleElementoAuditoriaSchema).optional(),
});

/** Fila de actividad: qué pasó, quién lo hizo y a quién afectó. */
export const FilaActividadAuditoriaSchema = z.object({
  id: z.string().uuid(),
  fecha: z.string(),
  accion: z.string(),
  accion_etiqueta: z.string(),
  modulo: z.string(),
  modulo_etiqueta: z.string(),
  //ID de la fila modificada en su tabla; permite enlazar a la pantalla del registro (por ejemplo una solicitud).
  registro_id: z.string().uuid(),
  actor: z
    .object({ id: z.string().uuid(), nombre: z.string(), rol: z.string() })
    .nullable(),
  afectado: z
    .object({
      tipo: z.enum(TIPOS_AFECTADO_AUDITORIA),
      id: z.string().uuid().nullable(),
      nombre: z.string(),
      detalle: z.string().nullable(),
    })
    .nullable(),
  resumen: z.string(),
  campos_modificados: z.array(z.string()),
});

/** Detalle de una fila de actividad: la fila más la lista de cambios. */
export const DetalleActividadAuditoriaSchema =
  FilaActividadAuditoriaSchema.extend({
    cambios: z.array(CambioActividadAuditoriaSchema),
  });

/** Metadatos de paginación. */
export const MetaPaginacionAuditoriaSchema = z.object({
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int(),
});

/** Respuesta paginada de `/actividad` y de `/afectados/:tipo/:id`. */
export const ListaActividadAuditoriaSchema = z.object({
  data: z.array(FilaActividadAuditoriaSchema),
  meta: MetaPaginacionAuditoriaSchema,
});

export type TipoAfectadoAuditoria = (typeof TIPOS_AFECTADO_AUDITORIA)[number];
export type AccionVistaAuditoria = (typeof ACCIONES_VISTA_AUDITORIA)[number];
export type TipoCampoAuditoria = (typeof TIPOS_CAMPO_AUDITORIA)[number];
export type ValorCambioAuditoria = z.output<typeof ValorCambioAuditoriaSchema>;
export type DetalleElementoAuditoria = z.output<
  typeof DetalleElementoAuditoriaSchema
>;
export type CambioActividadAuditoria = z.output<
  typeof CambioActividadAuditoriaSchema
>;
export type FilaActividadAuditoria = z.output<
  typeof FilaActividadAuditoriaSchema
>;
export type DetalleActividadAuditoria = z.output<
  typeof DetalleActividadAuditoriaSchema
>;
export type ListaActividadAuditoria = z.output<
  typeof ListaActividadAuditoriaSchema
>;
