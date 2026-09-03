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
     const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const skip = (page - 1) * limit;

      const where: Record<string, any> = { deleted_at: null };

      if (query.activo !== undefined) where.activo = query.activo;
      if (query.turno) where.turno = query.turno;
      if (query.modalidad) where.modalidad = query.modalidad;
      if (query.duracion) where.duracion = query.duracion;
      
      //Filtrado por búsqueda de texto en nombre o descripción de la jornada laboral
      if (query.search && query.search.trim() !== '')
        where.OR = [
          { nombre: { contains: query.search.trim(), mode: 'insensitive' } },
          { descripcion: { contains: query.search.trim(), mode: 'insensitive' } },
        ];
      
      //Filtrado directo por área aplicable a través de la tabla pivote
      if (query.area_id) 
        where.jornada_areas = {some: { area_id: query.area_id } };
      
      //Realizar la consulta a la base de datos con transacción para obtener el total y los registros paginados
      const [total, jornadas] = await this.prisma.$transaction([
        this.prisma.jornada.count({ where }),
        this.prisma.jornada.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
          include: {
            _count: {
              select: {
                empleados: { where: { activo: true, deleted_at: null } },
                jornada_areas: true
              }
            },
            jornada_areas: {include: { area: { select: { id: true, nombre: true } } } }
          }
        })
      ]);

      //Mapeo estructurado para la tabla del prototipo
      const data = jornadas.map((j) => ({
        id: j.id,
        nombre: j.nombre,
        descripcion: j.descripcion,
        duracion: j.duracion,
        turno: j.turno,
        modalidad: j.modalidad,
        tolerancia_minutos: j.tolerancia_minutos,
        total_horas_semana: Number(j.total_horas_semana),
        horario_semanal: j.horario_semanal,
        patron_rotacion: j.patron_rotacion,
        activo: j.activo,
        total_empleados: j._count.empleados,
        total_areas: j._count.jornada_areas,
        areas: j.jornada_areas.map((ja) => ja.area)
      }));

      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      };
    } catch (error) {
     throw new InternalServerErrorException( 'Ocurrió un error al obtener la lista de jornadas.', error instanceof Error ? error.message : undefined);
    }
  }
}