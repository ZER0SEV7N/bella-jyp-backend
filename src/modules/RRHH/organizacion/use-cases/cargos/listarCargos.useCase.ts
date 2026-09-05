//src/modules/RRHH/use-cases/cargos/listarCargos.useCase.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarCargosQueryDto } from '@jyp/shared-contracts';


/**
 * Clase que representa el caso de uso para listar los cargos en el módulo de RRHH.
 * Permite a los usuarios con los roles adecuados (ADMIN, RRHH) 
 * obtener un listado de cargos con soporte para paginación y filtrado por área y estado.
 * Se encarga de construir la consulta a la base de datos utilizando Prisma y devolver los resultados junto con metadatos de paginación.
 */
@Injectable()
export class ListarCargosUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista los cargos en el sistema con soporte para paginación y filtrado.
   * @param query - Los parámetros de consulta para filtrar y paginar los cargos.
   * @returns Un objeto con los cargos encontrados y metadatos de paginación.
   */
  async listar(query: ListarCargosQueryDto) {
    try {
      //Parametros de paginación y filtrado
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const skip = (page - 1) * limit;

      //Filtros
      const where: Record<string, any> = { deleted_at: null };

      if (query.activo !== undefined) where.activo = query.activo;
      if (query.id_area) where.id_area = query.id_area;
      
      //Búsqueda
      if (query.search && query.search.trim() !== '') 
        where.OR = [
          { nombre: { contains: query.search.trim(), mode: 'insensitive' } },
          { descripcion: { contains: query.search.trim(), mode: 'insensitive' } },
        ];
      
      //Realizar la consulta a la base de datos utilizando Prisma en una transacción para obtener el total y los cargos
      const [total, cargos] = await this.prisma.$transaction([
        this.prisma.cargo.count({ where }),
        this.prisma.cargo.findMany({
          where,
          skip,
          take: limit,
          orderBy: { nombre: 'asc' },
          include: {
            area: { select: { id: true, nombre: true } },
            _count: { select: { empleados: { where: { activo: true, deleted_at: null } } } }
          }
        })
      ]);

      //Mapear los cargos obtenidos a un formato más amigable para la respuesta
      const data = cargos.map((c) => ({
        id: c.id,
        id_area: c.id_area,
        nombre: c.nombre,
        descripcion: c.descripcion,
        sueldo_minimo: c.sueldo_minimo !== null ? Number(c.sueldo_minimo) : null,
        sueldo_maximo: c.sueldo_maximo !== null ? Number(c.sueldo_maximo) : null,
        activo: c.activo,
        area: c.area,
        total_empleados: c._count.empleados,
        created_at: c.created_at,
        updated_at: c.updated_at
      }));

      //Devolver los cargos junto con los metadatos de paginación
      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      };
    } catch (error) {
      throw new InternalServerErrorException({
        title: 'Error al listar cargos',
        detail: error instanceof Error ? error.message : 'Fallo al consultar los cargos.'
      });
    }
  }
}