//src/modules/RRHH/use-cases/cargos/listarCargos.useCase.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarCargosQueryDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para listar cargos con paginación y filtros en el módulo de RRHH
 */
@Injectable()
export class ListarCargosUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: ListarCargosQueryDto) {
    const page = Number(query.page) || 1; //Obtener el número de página, por defecto 1
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit; //Calcular el número de registros a omitir para la paginación

    const where: any = { deleted_at: null }; //Solo cargos no eliminados
    if (query?.id_area) where.id_area = query.id_area;
    if (query?.activo !== undefined) where.activo = query.activo === true;

    //Ejecutar la consulta a la base de datos utilizando Prisma
    const [total, cargos] = await this.prisma.$transaction([
      this.prisma.cargo.count({ where }), //Contar el total de cargos que cumplen con los filtros
      this.prisma.cargo.findMany({
        where: where,
        skip,
        take: limit,
        orderBy: { nombre: 'asc' }, //Ordenar por nombre ascendente
        include: {
          area: { select: { nombre: true } }, // Incluir el nombre del área asociada a cada cargo
        },
      }),
    ]);

    return {
      data: cargos,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
