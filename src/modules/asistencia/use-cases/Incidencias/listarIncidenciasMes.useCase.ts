//src/modules/asistencia/use-cases/Incidencias/listarIncidenciasMes.useCase.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarIncidenciasQueryDto } from '@jyp/shared-contracts';
import { calcularAccionesResumen } from '../../helpers/acciones-resumen.helper';
import { construirFiltroIncidencias } from '../../helpers/filtro-incidencias.helper';

/**
 * Caso de uso para listar las incidencias de asistencia mensuales (ASI-M3, ASI-M4).
 * Este caso de uso permite obtener un listado paginado de las incidencias de asistencia,
 * aplicando filtros opcionales como período, área, estado y búsqueda por DNI o nombres.
 * Devuelve un objeto con los datos de las incidencias (incluidas sus acciones permitidas) y la información de paginación.
 */
@Injectable()
export class ListarIncidenciasMesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta la consulta paginada de incidencias de asistencia mensuales con el estado de acciones permitidas por fila (ASI-M4).
   *
   * @param query - Parámetros de consulta para filtrar y paginar las incidencias.
   * @returns Objeto con los datos paginados de las incidencias (incluyendo `acciones`) y metadatos de paginación.
   */
  async execute(query: ListarIncidenciasQueryDto) {
    const { page, limit, periodo, area_id, estado, busqueda } = query;
    const skip = (page - 1) * limit;
    const periodoNormalizado = periodo.trim();
    const whereClause = construirFiltroIncidencias({
      periodo: periodoNormalizado,
      area_id,
      estado,
      busqueda,
    });

    const [total, registros] = await Promise.all([
      this.prisma.incidencias_mes.count({ where: whereClause }),
      this.prisma.incidencias_mes.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { empleado_id: 'asc' },
        select: {
          id: true,
          empleado_id: true,
          periodo: true,
          dias_trabajados: true,
          faltas: true,
          minutos_tardanza: true,
          horas_extras_25: true,
          horas_extras_35: true,
          estado: true,
          vigente: true,
          completo: true,
          pendientes: true,
          version: true,
          empleados: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              nro_documento: true,
              area: { select: { id: true, nombre: true } },
              cargo: { select: { id: true, nombre: true } },
            },
          },
        },
      }),
    ]);

    const empleadoIds = registros.map((r) => r.empleado_id);
    const planillas = empleadoIds.length
      ? await this.prisma.historial_planillas.findMany({
          where: {
            periodo: periodoNormalizado,
            empleado_id: { in: empleadoIds },
          },
          select: { empleado_id: true, estado: true },
        })
      : [];
    const estadoPlanillaPorEmpleado = new Map(
      planillas.map((p) => [p.empleado_id, p.estado])
    );

    const data = registros.map((r) => ({
      id: r.id,
      empleado_id: r.empleado_id,
      colaborador:
        `${r.empleados?.nombre ?? ''} ${r.empleados?.apellido ?? ''}`.trim(),
      nro_documento: r.empleados?.nro_documento ?? '',
      area: r.empleados?.area?.nombre ?? 'Sin Área',
      cargo: r.empleados?.cargo?.nombre ?? 'Sin Cargo',
      periodo: r.periodo,
      dias_trabajados: r.dias_trabajados,
      faltas: r.faltas,
      minutos_tardanza: r.minutos_tardanza,
      horas_extras_25: r.horas_extras_25.toString(),
      horas_extras_35: r.horas_extras_35.toString(),
      estado: r.estado,
      vigente: r.vigente,
      completo: r.completo,
      pendientes: r.pendientes,
      version: r.version,
      acciones: calcularAccionesResumen(
        r,
        estadoPlanillaPorEmpleado.get(r.empleado_id) ?? null
      ),
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Metodo para obtener una incidencia de asistencia por su ID.
   * @param id - ID de la incidencia de asistencia a obtener.
   * @returns - El registro de incidencia de asistencia correspondiente al ID proporcionado.
   * @throws - Lanza una excepción NotFoundException si no se encuentra el registro con el ID proporcionado.
   * @throws - Lanza una excepción InternalServerErrorException si ocurre un error inesperado durante la consulta a la base de datos.
   */
  async obtenerPorId(id: string) {
    const elemento = await this.prisma.incidencias_mes.findUnique({
      where: { id },
      include: {
        empleados: { select: { id: true, nombre: true, apellido: true } },
      },
    });

    //Si no se encuentra el registro, se lanza una excepción NotFoundException con un mensaje adecuado
    if (!elemento) throw new NotFoundException('Registro no encontrado.');

    //Devolución del registro encontrado
    return elemento;
  }
}
