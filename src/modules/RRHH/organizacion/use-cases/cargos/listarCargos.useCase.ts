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
      //Desestructurar los parámetros de consulta y establecer valores predeterminados
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 50;
      const skip = (page - 1) * limit;

      const where: Record<string, any> = { deleted_at: null };

      //Filtrar por área y jornada sugerida si se proporcionan en la consulta
      if (query.id_area)  where.id_area = query.id_area;
      if (query.jornada_sugerida_id) where.jornada_sugerida_id = query.jornada_sugerida_id;
      if (typeof query.activo === 'boolean') where.activo = query.activo;

      const [total, cargos] = await this.prisma.$transaction([
        this.prisma.cargo.count({ where }),
        this.prisma.cargo.findMany({
          where,
          skip,
          take: limit,
          orderBy: { nombre: 'asc' },
          include: {
            area: { select: { id: true, nombre: true } },
            jornada_sugerida: {
              select: {
                id: true,
                nombre: true,
                tipo_jornada: true,
                hora_entrada: true,
                hora_salida: true
              }
            },
            _count: { select: {empleados: { where: { activo: true, deleted_at: null } } } }
          }
        })
      ]);

      return {
        data: cargos,
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