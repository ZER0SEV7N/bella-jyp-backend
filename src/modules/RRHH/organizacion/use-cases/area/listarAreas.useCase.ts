//src/modules/RRHH/organizacion/use-cases/areas/listarAreas.useCase.ts
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

      const where: Prisma.areaWhereInput = { deleted_at: null };

      //Filtrar por estado si se proporciona en la consulta
      if (query.activo !== undefined) where.activo = query.activo;
      //Filtrar por búsqueda en nombre o descripción si se proporciona en la consulta
      if (query.search && query.search.trim() !== '')
        where.OR = [
          { nombre: { contains: query.search.trim(), mode: 'insensitive' } },
          { descripcion: { contains: query.search.trim(), mode: 'insensitive' } },
        ];

      //Realizar la consulta a la base de datos utilizando Prisma en una transacción para obtener el total y las áreas
      const [total, areas] = await this.prisma.$transaction([
        this.prisma.area.count({ where }),
        this.prisma.area.findMany({
          where,
          skip,
          take: limit,
          orderBy: { nombre: 'asc' },
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            activo: true,
            _count: {
              select: {
                cargo: { where: { activo: true, deleted_at: null } },
                empleados: { where: { activo: true, deleted_at: null } },
                jornada_areas: true,
              },
            },
          },
        }),
      ]);

      //Mapear los resultados para incluir solo los campos necesarios y los conteos de relaciones
      const data = areas.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        descripcion: a.descripcion,
        activo: a.activo,
        total_cargos: a._count.cargo,
        total_empleados: a._count.empleados,
        total_jornadas: a._count.jornada_areas,
      }));

      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      throw new InternalServerErrorException('Ocurrió un error al obtener el listado de áreas.', error instanceof Error ? error.message : undefined);
    }
  }

  /**
   * Obtiene un área por su ID, incluyendo sus cargos y jornadas asociadas.
   * @param id - El ID del área que se desea obtener.
   * @throws NotFoundException si el área con el ID proporcionado no existe o ha sido eliminada.
   * @throws InternalServerErrorException si ocurre un error inesperado durante la consulta.
   * @returns - El área encontrada con sus cargos y jornadas asociadas.
   */
  async obtenerPorId(id: string) {
    const elemento = await this.prisma.area.findUnique({
      where: { id, deleted_at: null },
      include: { cargo: { where: { deleted_at: null } }, jornada_areas: { include: { jornada: true } } },
    });
    if (!elemento) throw new NotFoundException('No se encontró el registro solicitado.');
    return elemento;
  }
}
