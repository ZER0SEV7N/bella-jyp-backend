//src/modules/RRHH/use-cases/empleado/ObtenerEmpleados.useCase.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ListarEmpleadosQueryDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para listar empleados con soporte para paginación, filtrado y búsqueda.
 * Este caso de uso encapsula la lógica de negocio relacionada con la obtención de empleados, 
 * asegurando que las operaciones se realicen de manera consistente y segura.
 * @param prisma - Instancia del servicio Prisma para acceder a la base de datos.
 */
@Injectable()
export class ListarEmpleadosUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /** 
   * Ejecuta el caso de uso para listar empleados.
   * @param query - Parámetros de consulta para filtrar y paginar los resultados.
   * @returns - Un objeto con los empleados encontrados y la metadata de la paginación.
   */
  async execute(query: ListarEmpleadosQueryDto) {
    try {
      //Configuración de paginación: página actual, límite de resultados por página y cálculo del offset (skip).
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      const skip = (page - 1) * limit;

      //Construcción de la condición WHERE para filtrar empleados según los parámetros proporcionados en la consulta.
      const where: Record<string, any> = { deleted_at: null };

      if (query.activo !== undefined) where.activo = query.activo;
      if (query.area_id) where.area_id = query.area_id;
      if (query.cargo_id) where.cargo_id = query.cargo_id;
      if (query.jornada_id) where.jornada_id = query.jornada_id;
      if (query.search && query.search.trim() !== '') {
        const search = query.search.trim();
        where.OR = [
          { nro_documento: { contains: search, mode: 'insensitive' } },
          { nombre: { contains: search, mode: 'insensitive' } },
          { apellido: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      //Ejecución de la transacción para contar el total de empleados y obtener la lista paginada de empleados según los filtros aplicados.
      const [total, empleados] = await this.prisma.$transaction([
        this.prisma.empleados.count({ where }),
        this.prisma.empleados.findMany({
          where,
          skip,
          take: limit,
          orderBy: { apellido: 'asc' },
          include: {
            area: { select: { id: true, nombre: true } },
            cargo: { select: { id: true, nombre: true } },
            estado_empleado: { select: { id: true, descripcion: true } },
            jornada: { select: { id: true, nombre: true, turno: true } },
            dato_financiero: { select: { sueldo_basico: true, regimen_salud: true } }
          }
        })
      ]);

      return {
        data: empleados,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      };
    } catch (error) {
      throw new InternalServerErrorException({
        title: 'Error al Listar Empleados',
        detail: error instanceof Error ? error.message : 'Fallo inesperado al consultar el catálogo de empleados.'
      });
    }
  }
}