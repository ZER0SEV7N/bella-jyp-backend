//src/modules/asistencia/use-cases/Incidencias/contarIncidenciasMes.useCase.ts
import { Injectable } from '@nestjs/common';
import type { estado_incidencia_enum } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { construirFiltroIncidencias } from '../../helpers/filtro-incidencias.helper';

/**
 * Parámetros de consulta para obtener los totales por estado del cierre mensual.
 */
export interface ContarIncidenciasMesQuery {
  periodo: string;
  area_id?: string;
}

/**
 * Totales agrupados por estado de incidencia para un período.
 */
export type TotalesIncidenciasMes = Record<estado_incidencia_enum, number>;

/**
 * Caso de uso para contar los resúmenes mensuales de asistencia agrupados por estado (ASI-M3).
 */
@Injectable()
export class ContarIncidenciasMesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene el conteo de resúmenes mensuales por estado (`PENDIENTE`, `APROBADO`, `RECHAZADO`) para un período y área opcional.
   *
   * @param query - Filtros de período y área opcional.
   * @returns Objeto con los tres estados inicializados en cero cuando no tienen registros.
   */
  async execute(
    query: ContarIncidenciasMesQuery
  ): Promise<TotalesIncidenciasMes> {
    const where = construirFiltroIncidencias({
      periodo: query.periodo,
      area_id: query.area_id,
    });

    const grupos = await this.prisma.incidencias_mes.groupBy({
      by: ['estado'],
      where,
      _count: { _all: true },
    });

    const totales: TotalesIncidenciasMes = {
      PENDIENTE: 0,
      APROBADO: 0,
      RECHAZADO: 0,
    };

    for (const grupo of grupos) {
      totales[grupo.estado] = grupo._count._all;
    }

    return totales;
  }
}
