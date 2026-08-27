//src/modules/RRHH/use-cases/jornadas/listarJornada.useCase.ts
//Caso de uso para listar las jornadas laborales con paginación y filtrado
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarJornadasQueryDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para listar las jornadas laborales en el sistema.
 * Permite a los usuarios con los roles adecuados (ADMIN, RRHH)
 * obtener un listado de jornadas laborales con soporte para paginación y filtrado por estado y tipo de jornada.
 */
@Injectable()
export class ListarJornadaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para listar las jornadas laborales con paginación y filtrado.
   * @param query - Parámetros de consulta para la paginación y filtrado de las jornadas laborales.
   * @returns Un objeto que contiene la lista de jornadas laborales y metadatos de paginación.
   * @throws {InternalServerErrorException} Si ocurre un error inesperado al consultar las jornadas laborales.
   */
  async execute(query: ListarJornadasQueryDto) {
    try {
      //Desestructurar los parámetros de consulta y establecer valores predeterminados
      const { page = 1, limit = 50, activo, tipo_jornada } = query;
      const skip = (page - 1) * limit;
      const where: Record<string, any> = { deleted_at: null };

      if (activo !== undefined) where.activo = activo;
      if (tipo_jornada) where.tipo_jornada = tipo_jornada;
      
      //Ejecutar la transacción para contar el total de jornadas y obtener la lista de jornadas con paginación
      const [total, jornadas] = await this.prisma.$transaction([
        this.prisma.jornada.count({ where }),
        this.prisma.jornada.findMany({
          where,
          skip,
          take: limit,
          orderBy: { nombre: 'asc' },
          include: {
            _count: {
              select: {
                empleados: { where: { activo: true, deleted_at: null } },
                cargos_sugeridos: { where: { activo: true, deleted_at: null } }
              }
            }
          }
        })
      ]);

      return {
        data: jornadas,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit)}
      };
    } catch (error) {
      throw new InternalServerErrorException({
        title: 'Error al listar jornadas',
          detail: error instanceof Error ? error.message : 'Fallo inesperado al consultar las jornadas.',
      });
    }
  }
}
