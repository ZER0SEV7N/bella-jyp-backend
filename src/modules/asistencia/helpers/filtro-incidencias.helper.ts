//src/modules/asistencia/helpers/filtro-incidencias.helper.ts
import type { Prisma, estado_incidencia_enum } from '@prisma/client';

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
      deleted_at: null,
      ...(area_id && { area_id }),
      ...(busqueda && {
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
      }),
    };
  }

  return where;
}
