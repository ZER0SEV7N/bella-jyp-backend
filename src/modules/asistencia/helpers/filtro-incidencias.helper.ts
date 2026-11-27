//src/modules/asistencia/helpers/filtro-incidencias.helper.ts
import { ListarIncidenciasQuerySchema } from '@jyp/shared-contracts';
import type { ListarIncidenciasQueryDto } from '@jyp/shared-contracts';
import type { Prisma, estado_incidencia_enum } from '@prisma/client';
import type { ZodSchemaLike } from '@/common/pipes/zod-validation.pipe';
import { criterioVigenciaEnPeriodo } from './criterio-vigencia.helper';

/**
 * Esquema de consulta para obtener los totales por estado del cierre mensual de asistencia (ASI-M3).
 *
 * @remarks
 * El tipo va anotado porque el inferido viene del zod interno de shared-contracts y no se puede
 * nombrar en la declaración (TS2742). Basta con lo que usan `ZodValidationPipe` y Swagger.
 */
export const TotalesIncidenciasQuerySchema: ZodSchemaLike & { _def: unknown } =
  ListarIncidenciasQuerySchema.pick({
    periodo: true,
    area_id: true,
  });

/**
 * Parámetros de consulta validados para el endpoint de totales de incidencias mensuales.
 */
export type TotalesIncidenciasQueryDto = Pick<
  ListarIncidenciasQueryDto,
  'periodo' | 'area_id'
>;

/**
 * Parámetros admitidos para construir el filtro de incidencias mensuales.
 */
export interface FiltroIncidenciasParams {
  periodo: string;
  area_id?: string;
  busqueda?: string;
  estado?: estado_incidencia_enum;
}

/**
 * Construye la cláusula `where` de Prisma para consultar resúmenes mensuales de incidencias (ASI-M3).
 *
 * @param params - Filtros opcionales de período, área, búsqueda por colaborador y estado.
 * @returns Cláusula `where` lista para consultas `count`, `findMany` o `groupBy` sobre `incidencias_mes`.
 */
export function construirFiltroIncidencias({
  periodo,
  area_id,
  busqueda,
  estado,
}: FiltroIncidenciasParams): Prisma.incidencias_mesWhereInput {
  const where: Prisma.incidencias_mesWhereInput = { periodo: periodo.trim() };

  if (estado) {
    where.estado = estado;
  }

  if (area_id || busqueda) {
    where.empleados = {
      //La vigencia la determina el vínculo, no el soft-delete (ASI-F6).
      ...criterioVigenciaEnPeriodo(periodo),
      ...(area_id && { area_id }),
      ...(busqueda && {
        AND: [
          {
            OR: [
              {
                nro_documento: {
                  contains: busqueda.trim(),
                  mode: 'insensitive',
                },
              },
              { nombre: { contains: busqueda.trim(), mode: 'insensitive' } },
              { apellido: { contains: busqueda.trim(), mode: 'insensitive' } },
            ],
          },
        ],
      }),
    };
  }

  return where;
}
