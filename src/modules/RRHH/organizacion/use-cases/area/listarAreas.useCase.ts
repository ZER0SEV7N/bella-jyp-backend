//src/modules/RRHH/organizacion/use-cases/areas/listarAreas.useCase.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarAreasQueryDto } from '@jyp/shared-contracts';

/**
 * Clase que representa el caso de uso para listar las áreas en el módulo de RRHH.
 * Permite a los usuarios con los roles adecuados (ADMIN, RRHH)
 * obtener un listado de áreas con soporte para paginación y filtrado por estado y búsqueda por nombre o descripción.
 * Se encarga de construir la consulta a la base de datos utilizando Prisma y devolver los resultados junto con metadatos de paginación.
 */
@Injectable()
export class ListarAreasUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista las áreas con soporte para paginación y filtrado.
   * @param query - Los parámetros de consulta para filtrar y paginar las áreas.
   * @returns Un objeto con las áreas encontradas y metadatos de paginación.
   * @throws InternalServerErrorException si ocurre un error inesperado durante la consulta.
   */
  async listar(query: ListarAreasQueryDto) {
    try {
      //Parametros de paginación y filtrado
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const skip = (page - 1) * limit;

      const where: Record<string, any> = { deleted_at: null };

      //Filtrar por estado si se proporciona en la consulta
      if (query.activo !== undefined) 
        where.activo = query.activo;

      //Filtrar por búsqueda en nombre o descripción si se proporciona en la consulta
      if (query.search && query.search.trim() !== '') 
        where.OR = [
          { nombre: { contains: query.search.trim(), mode: 'insensitive' } },
          { descripcion: { contains: query.search.trim(), mode: 'insensitive' } }
        ];
      
      //Realizar la consulta a la base de datos utilizando Prisma en una transacción para obtener el total y las áreas
      const [total, areas] = await this.prisma.$transaction([
        this.prisma.area.count({ where }),
        this.prisma.area.findMany({
          where,
          skip,
          take: limit,
          orderBy: { nombre: 'asc' },
          include: {
            _count: {
              select: {
                cargo: { where: { deleted_at: null, activo: true } },
                empleados: { where: { deleted_at: null, activo: true } },
                jornada_areas: true
              }
            }
          }
        })
      ]);

      //Mapear los resultados para incluir solo los campos necesarios y los conteos de relaciones
      const data = areas.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        descripcion: a.descripcion,
        activo: a.activo,
        total_cargos: a._count.cargo,
        total_empleados: a._count.empleados,
        total_jornadas: a._count.jornada_areas
      }));

      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      };
    } catch (error) {
      throw new InternalServerErrorException('Ocurrió un error al obtener el listado de áreas.', error instanceof Error ? error.message : undefined);
    }
  }
}