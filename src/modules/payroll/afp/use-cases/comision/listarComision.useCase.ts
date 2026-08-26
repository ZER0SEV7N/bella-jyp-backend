//src/modules/afp/use-cases/comision/listarComisiones.useCase.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarComisionesQueryDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para listar las comisiones de AFP.
 * Este caso de uso tiene como objetivo obtener una lista de comisiones de AFP desde la base de datos, con soporte para paginación y filtrado.
 * @param query - Objeto de transferencia de datos que contiene los parámetros de paginación y filtrado.
 * @returns Una lista de comisiones de AFP que cumplen con los criterios especificados en el objeto de consulta.
 */
@Injectable()
export class ListarComisionesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  //Maneja la lógica para listar las comisiones de AFP con paginación y filtrado
  async listar(query: ListarComisionesQueryDto) {
    const { page, limit, afp_id, solo_vigentes } = query;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    //Si se proporciona un afp_id, filtramos por ese ID
    if (afp_id) whereClause.afp_id = afp_id;
    //Si se solicita solo las comisiones vigentes, filtramos por periodo_final nulo
    if (solo_vigentes) whereClause.periodo_final = null;

    const [total, comisiones] = await this.prisma.$transaction([
      this.prisma.comisiones_afp.count({ where: whereClause }),
      this.prisma.comisiones_afp.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { periodo_inicio: 'desc' },
        include: { tipo_afp: { select: { nombre: true } } } //AFP: Incluir el nombre del tipo de AFP asociado
      })
    ]);

    return {
      data: comisiones,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}
