//src/modules/RRHH/use-cases/empleado/ObtenerEmpleados.useCase.ts
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
      const where: Prisma.empleadosWhereInput = { OR: [{ deleted_at: null }, { estado_laboral: { in: ['CESADO', 'DESPEDIDO'] } }] };

      if (query.estado_laboral) where.estado_laboral = query.estado_laboral;
      if (query.activo !== undefined) where.activo = query.activo;
      if (query.area_id) where.area_id = query.area_id;
      if (query.cargo_id) where.cargo_id = query.cargo_id;
      if (query.jornada_id) {
        const fecha = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()));
        const ids = await this.prisma.$queryRaw<{ id: string }[]>`SELECT e.id FROM empleados e
          LEFT JOIN LATERAL (SELECT jornada_id FROM asistencia_jornada a WHERE a.empleado_id = e.id AND a.desde <= ${fecha}::date ORDER BY a.desde DESC LIMIT 1) vigente ON true
          WHERE COALESCE(vigente.jornada_id, e.jornada_id) = ${query.jornada_id}::uuid`;
        where.id = { in: ids.map((e) => e.id) };
      }
      if (query.search && query.search.trim() !== '') {
        const search = query.search.trim();
        where.AND = [
          {
            OR: [
              { nro_documento: { contains: search, mode: 'insensitive' } },
              { nombre: { contains: search, mode: 'insensitive' } },
              { apellido: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
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
          select: {
            id: true,
            nombre: true,
            apellido: true,
            nro_documento: true,
            email: true,
            estado_laboral: true,
            activo: true,
            fecha_inicio: true,
            fecha_cese: true,
            area: { select: { id: true, nombre: true } },
            cargo: { select: { id: true, nombre: true } },
            jornada: { select: { id: true, nombre: true } },
            jornadas_asistencia: {
              where: { desde: { lte: new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())) } },
              orderBy: { desde: 'desc' },
              take: 1,
              select: { jornada: { select: { id: true, nombre: true } } },
            },
          },
        }),
      ]);

      return {
        data: empleados.map(({ nombre, apellido, jornadas_asistencia, ...e }) => ({
          ...e,
          nombre_completo: `${nombre} ${apellido}`.trim(),
          jornada: jornadas_asistencia[0]?.jornada ?? e.jornada,
        })),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      throw new InternalServerErrorException({
        title: 'Error al Listar Empleados',
        detail: error instanceof Error ? error.message : 'Fallo inesperado al consultar el catálogo de empleados.',
      });
    }
  }

  /** Ficha personal completa; las cuentas y sueldos se consultan en el módulo financiero protegido. */
  async obtenerPorId(id: string) {
    const empleado = await this.prisma.empleados.findUnique({
      where: { id },
      include: {
        area: { select: { id: true, nombre: true } },
        cargo: { select: { id: true, nombre: true } },
        jornada: { select: { id: true, nombre: true } },
        tipo_documento: true,
        derechohabientes: { where: { deleted_at: null } },
        contratos: { where: { deleted_at: null }, orderBy: { fecha_inicio: 'desc' } },
      },
    });
    if (!empleado || (empleado.deleted_at && !['CESADO', 'DESPEDIDO'].includes(empleado.estado_laboral)))
      throw new NotFoundException('Colaborador no encontrado.');
    const vigente = await this.prisma.asistencia_jornada.findFirst({
      where: {
        empleado_id: id,
        desde: { lte: new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())) },
      },
      orderBy: { desde: 'desc' },
      include: { jornada: true },
    });
    return {
      ...empleado,
      nombre_completo: `${empleado.nombre} ${empleado.apellido}`.trim(),
      jornada: vigente?.jornada ?? empleado.jornada,
    };
  }
}
