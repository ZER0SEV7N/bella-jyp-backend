//src/modules/afp/use-cases/aportacion/listarAportacion.useCase.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarAportacionesQueryDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para listar las aportaciones de AFP.
 * Este caso de uso tiene como objetivo obtener una lista de aportaciones de AFP desde la base de datos, con soporte para paginación y filtrado.
 * @param query - Objeto de transferencia de datos que contiene los parámetros de paginación y filtrado.
 * @returns Una lista de aportaciones de AFP que cumplen con los criterios especificados en el objeto de consulta.
 */
@Injectable()
export class ListarAportacionesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: ListarAportacionesQueryDto) {
    const { page, limit, afp_id } = query;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    //Si se proporciona un afp_id, filtramos por ese ID
    if (afp_id) whereClause.afp_id = afp_id;

    const [total, aportaciones] = await this.prisma.$transaction([
      this.prisma.aportaciones.count({ where: whereClause }),
      this.prisma.aportaciones.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { nombre: 'desc' },
        include: { tipo_afp: { select: { nombre: true } } }, //AFP: Incluir el nombre del tipo de AFP asociado
      }),
    ]);

    return {
      data: aportaciones,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
