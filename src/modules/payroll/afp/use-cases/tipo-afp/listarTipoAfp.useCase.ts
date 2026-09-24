//src/modules/afp/use-cases/tipo-afp/listarTiposAfp.useCase.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarTiposAfpQueryDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para listar los tipos de AFP.
 * Este caso de uso tiene como objetivo obtener una lista de tipos de AFP desde la base de datos, con soporte para paginación y filtrado.
 * @param query - Objeto de transferencia de datos que contiene los parámetros de paginación y filtrado.
 * @returns Una lista de tipos de AFP que cumplen con los criterios especificados en el objeto de consulta.
 */
@Injectable()
export class ListarTiposAfpUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista los tipos de AFP con paginación y filtrado.
   * @param query - Objeto de transferencia de datos que contiene los parámetros de paginación y filtrado.
   * @returns Una lista de tipos de AFP que cumplen con los criterios especificados en el objeto de consulta.
   */
  async listar(query: ListarTiposAfpQueryDto) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    //Realizar la consulta a la base de datos para obtener el total de tipos de AFP y los tipos de AFP paginados
    const [total, tipos] = await this.prisma.$transaction([
      this.prisma.tipo_afp.count(),
      this.prisma.tipo_afp.findMany({
        skip,
        take: limit,
        orderBy: { nombre: 'asc' },
        include: {regimen_pension: { select: { nombre: true } }} //AFP: Incluir el nombre del régimen de pensión asociado
      })
    ]);

    return {
      data: tipos,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
  }
}
