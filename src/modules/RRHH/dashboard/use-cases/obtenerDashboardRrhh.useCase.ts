//src/modules/RRHH/dashboard/use-cases/obtenerDashboardRrhh.useCase.ts
import { Injectable } from '@nestjs/common';
import {
  EstadoSolicitud,
  estado_contrato_enum,
  type Prisma,
} from '@prisma/client';
import {
  DASHBOARD_RRHH_LIMITE_LISTA,
  type DashboardRrhhQueryDto,
  type DashboardRrhhResponseDto,
} from '@jyp/shared-contracts';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { CacheCatalogoService } from '@/common/config/redis/cache-catalogo.service';
import {
  DASHBOARD_CACHE_TTL_SEGUNDOS,
  claveDashboardCache,
} from '@/common/config/redis/claves-cache';
import { ContarIncidenciasMesUseCase } from '@/modules/asistencia/use-cases/Incidencias/contarIncidenciasMes.useCase';
import {
  diferenciaDiasSimples,
  resolverContextoFechasDashboard,
  sumarDiasFechaSimple,
  type ContextoFechasDashboard,
} from '../helpers/dashboard-fechas.helper';
import {
  calcularRotacionPorcentaje,
  construirDistribucionAreas,
  redondearDosDecimales,
} from '../helpers/dashboard-dotacion.helper';
import { construirAsistenciaSemana } from '../helpers/dashboard-asistencia.helper';

const DIAS_ALERTA_CRITICA = 15;
const DIAS_VENTANA_ALERTAS_CONTRATO = 30;

interface CumpleanosFilaSql {
  empleado_id: string;
  nombre_completo: string;
  dia: number;
  mes: number;
  area: string;
  cargo: string;
  total_mes: number;
}

/**
 * Caso de uso para construir el resumen integral del dashboard de RRHH.
 */
@Injectable()
export class ObtenerDashboardRrhhUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contarIncidenciasMesUseCase: ContarIncidenciasMesUseCase,
    private readonly cache: CacheCatalogoService
  ) {}

  /**
   * Obtiene todos los bloques del dashboard de RRHH para el período indicado o el mes en curso.
   *
   * @param query - Parámetros validados de consulta (`periodo` opcional en formato `YYYY-MM`).
   * @returns Respuesta completa ajustada a `DashboardRrhhResponseSchema`.
   * @throws {UnprocessableEntityException} Si el período solicitado corresponde a un mes futuro.
   */
  async execute(
    query: DashboardRrhhQueryDto
  ): Promise<DashboardRrhhResponseDto> {
    const fechas = resolverContextoFechasDashboard(query.periodo);

    // Cache-aside por período: evita recalcular los indicadores en cada petición (Mejora 3).
    // Se invalida cuando cambia la asistencia o las planillas del período.
    return this.cache.getOrSet(
      claveDashboardCache(fechas.periodo),
      DASHBOARD_CACHE_TTL_SEGUNDOS,
      () => this.construir(fechas)
    );
  }

  private async construir(
    fechas: ContextoFechasDashboard
  ): Promise<DashboardRrhhResponseDto> {
    const [
      dotacion,
      asistenciaSemana,
      cierreAsistencia,
      cumpleanos,
      contratosAlertas,
      solicitudesTramite,
    ] = await Promise.all([
      this.obtenerDotacion(fechas),
      this.obtenerAsistenciaSemana(fechas),
      this.obtenerCierreAsistencia(fechas),
      this.obtenerCumpleanos(fechas),
      this.obtenerContratosAlertas(fechas),
      this.obtenerSolicitudesTramite(),
    ]);

    return {
      dotacion,
      asistencia_semana: asistenciaSemana,
      cierre_asistencia: cierreAsistencia,
      cumpleanos,
      contratos_alertas: contratosAlertas,
      solicitudes_tramite: solicitudesTramite,
      metadata: {
        periodo: fechas.periodo,
        fecha_corte: fechas.fechaCorte,
        generado_en: fechas.generadoEn,
      },
    };
  }

  private whereActivoEnDia(fecha: string): Prisma.empleadosWhereInput {
    const dia = ServerTime.desdeFechaSimple(fecha);
    return {
      fecha_inicio: { lte: dia },
      OR: [{ fecha_cese: null }, { fecha_cese: { gte: dia } }],
    };
  }

  private async obtenerDotacion(
    fechas: ContextoFechasDashboard
  ): Promise<DashboardRrhhResponseDto['dotacion']> {
    const primerDiaMes = ServerTime.desdeFechaSimple(fechas.primerDiaMes);
    const fechaCorte = ServerTime.desdeFechaSimple(fechas.fechaCorte);
    const primerDiaAnterior = ServerTime.desdeFechaSimple(
      fechas.primerDiaMesAnterior
    );
    const ultimoDiaAnterior = ServerTime.desdeFechaSimple(
      fechas.ultimoDiaMesAnterior
    );

    const whereActivosCorte = this.whereActivoEnDia(fechas.fechaCorte);

    const [
      totalActivos,
      activosDia1,
      altasMes,
      cesesMes,
      prevActivosCorte,
      prevActivosDia1,
      prevAltas,
      prevCeses,
      gruposAreas,
    ] = await Promise.all([
      this.prisma.empleados.count({ where: whereActivosCorte }),
      this.prisma.empleados.count({
        where: this.whereActivoEnDia(fechas.primerDiaMes),
      }),
      this.prisma.empleados.count({
        where: { fecha_inicio: { gte: primerDiaMes, lte: fechaCorte } },
      }),
      this.prisma.empleados.count({
        where: { fecha_cese: { gte: primerDiaMes, lte: fechaCorte } },
      }),
      this.prisma.empleados.count({
        where: this.whereActivoEnDia(fechas.ultimoDiaMesAnterior),
      }),
      this.prisma.empleados.count({
        where: this.whereActivoEnDia(fechas.primerDiaMesAnterior),
      }),
      this.prisma.empleados.count({
        where: {
          fecha_inicio: { gte: primerDiaAnterior, lte: ultimoDiaAnterior },
        },
      }),
      this.prisma.empleados.count({
        where: {
          fecha_cese: { gte: primerDiaAnterior, lte: ultimoDiaAnterior },
        },
      }),
      this.prisma.empleados.groupBy({
        by: ['area_id'],
        where: whereActivosCorte,
        _count: { _all: true },
      }),
    ]);

    const areaIds = gruposAreas.map((g) => g.area_id);
    const areas = areaIds.length
      ? await this.prisma.area.findMany({
          where: { id: { in: areaIds } },
          select: { id: true, nombre: true },
        })
      : [];
    const nombrePorArea = new Map(areas.map((a) => [a.id, a.nombre]));

    const distribucionAreas = construirDistribucionAreas(
      gruposAreas.map((g) => ({
        area_id: g.area_id,
        nombre: nombrePorArea.get(g.area_id) ?? 'Sin Área',
        total_empleados: g._count._all,
      })),
      totalActivos
    );

    const rotacionActual = calcularRotacionPorcentaje(
      cesesMes,
      activosDia1,
      totalActivos
    );
    const rotacionAnterior = calcularRotacionPorcentaje(
      prevCeses,
      prevActivosDia1,
      prevActivosCorte
    );

    return {
      total_activos: totalActivos,
      altas_mes: altasMes,
      ceses_mes: cesesMes,
      rotacion_porcentaje: rotacionActual,
      comparacion: {
        periodo: fechas.periodoAnterior,
        activos: prevActivosCorte,
        altas: prevAltas,
        ceses: prevCeses,
        rotacion_puntos_porcentuales: redondearDosDecimales(
          rotacionActual - rotacionAnterior
        ),
      },
      distribucion_areas: distribucionAreas,
    };
  }

  private async obtenerAsistenciaSemana(
    fechas: ContextoFechasDashboard
  ): Promise<DashboardRrhhResponseDto['asistencia_semana']> {
    const filas = fechas.periodosSemana.length
      ? await this.prisma.incidencias_mes.findMany({
          where: {
            periodo: { in: fechas.periodosSemana },
          },
          select: {
            detalle: true,
            actualizado_en: true,
          },
        })
      : [];

    return construirAsistenciaSemana(
      fechas.fechasSemanaVisibles,
      fechas.semanaDesde,
      fechas.semanaHasta,
      filas
    );
  }

  private async obtenerCierreAsistencia(
    fechas: ContextoFechasDashboard
  ): Promise<DashboardRrhhResponseDto['cierre_asistencia']> {
    const [totales, sinCalcular] = await Promise.all([
      this.contarIncidenciasMesUseCase.execute({ periodo: fechas.periodo }),
      this.prisma.empleados.count({
        where: {
          ...this.whereActivoEnDia(fechas.fechaCorte),
          incidencias: {
            none: { periodo: fechas.periodo },
          },
        },
      }),
    ]);

    return {
      pendientes: totales.PENDIENTE,
      aprobados: totales.APROBADO,
      rechazados: totales.RECHAZADO,
      sin_calcular: sinCalcular,
    };
  }

  private async obtenerCumpleanos(
    fechas: ContextoFechasDashboard
  ): Promise<DashboardRrhhResponseDto['cumpleanos']> {
    const mes = Number(fechas.periodo.slice(5, 7));

    const filas = await this.prisma.$queryRaw<CumpleanosFilaSql[]>`
      SELECT
        e.id AS empleado_id,
        TRIM(CONCAT(e.nombre, ' ', e.apellido)) AS nombre_completo,
        EXTRACT(DAY FROM e.fecha_nacimiento)::int AS dia,
        EXTRACT(MONTH FROM e.fecha_nacimiento)::int AS mes,
        COALESCE(a.nombre, 'Sin Área') AS area,
        COALESCE(c.nombre, 'Sin Cargo') AS cargo,
        COUNT(*) OVER()::int AS total_mes
      FROM empleados e
      LEFT JOIN area a ON a.id = e.area_id
      LEFT JOIN cargo c ON c.id = e.cargo_id
      WHERE e.fecha_inicio <= ${fechas.fechaCorte}::date
        AND (e.fecha_cese IS NULL OR e.fecha_cese >= ${fechas.fechaCorte}::date)
        AND EXTRACT(MONTH FROM e.fecha_nacimiento)::int = ${mes}
      ORDER BY EXTRACT(DAY FROM e.fecha_nacimiento) ASC, e.nombre ASC, e.apellido ASC
      LIMIT ${DASHBOARD_RRHH_LIMITE_LISTA}
    `;

    return {
      total_mes: filas[0]?.total_mes ?? 0,
      primeros: filas.map((fila) => ({
        empleado_id: fila.empleado_id,
        nombre_completo: fila.nombre_completo,
        dia: fila.dia,
        mes: fila.mes,
        area: fila.area,
        cargo: fila.cargo,
      })),
    };
  }

  /**
   * Obtiene los contratos próximos a vencer dentro de los 30 días posteriores a `fechaCorte`
   * para colaboradores activos en esa fecha. En el mes en curso solo considera estado `VIGENTE`;
   * en meses pasados incluye `VIGENTE`, `RENOVADO`, `VENCIDO` y `FINALIZADO` (excluye `ANULADO`),
   * ya que el contrato pudo cambiar de estado luego de la fecha de corte histórica.
   *
   * @param fechas - Contexto temporal resuelto del dashboard.
   * @returns Totales de alertas críticas/preventivas y los primeros contratos próximos a vencer.
   */
  private async obtenerContratosAlertas(
    fechas: ContextoFechasDashboard
  ): Promise<DashboardRrhhResponseDto['contratos_alertas']> {
    const fechaCorteDate = ServerTime.desdeFechaSimple(fechas.fechaCorte);
    const fechaTope15Date = ServerTime.desdeFechaSimple(
      sumarDiasFechaSimple(fechas.fechaCorte, DIAS_ALERTA_CRITICA)
    );
    const fechaTope30Date = ServerTime.desdeFechaSimple(
      sumarDiasFechaSimple(fechas.fechaCorte, DIAS_VENTANA_ALERTAS_CONTRATO)
    );

    const estadoFiltro: Prisma.contratosWhereInput['estado'] =
      fechas.esMesActual
        ? estado_contrato_enum.VIGENTE
        : {
            in: [
              estado_contrato_enum.VIGENTE,
              estado_contrato_enum.RENOVADO,
              estado_contrato_enum.VENCIDO,
              estado_contrato_enum.FINALIZADO,
            ],
          };

    const whereBase: Prisma.contratosWhereInput = {
      estado: estadoFiltro,
      deleted_at: null,
      empleados: this.whereActivoEnDia(fechas.fechaCorte),
    };

    const [criticos15d, preventivos30d, contratos] = await Promise.all([
      this.prisma.contratos.count({
        where: {
          ...whereBase,
          fecha_fin: { gte: fechaCorteDate, lte: fechaTope15Date },
        },
      }),
      this.prisma.contratos.count({
        where: {
          ...whereBase,
          fecha_fin: { gt: fechaTope15Date, lte: fechaTope30Date },
        },
      }),
      this.prisma.contratos.findMany({
        where: {
          ...whereBase,
          fecha_fin: { gte: fechaCorteDate, lte: fechaTope30Date },
        },
        take: DASHBOARD_RRHH_LIMITE_LISTA,
        orderBy: [{ fecha_fin: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          empleado_id: true,
          fecha_fin: true,
          empleados: {
            select: {
              nombre: true,
              apellido: true,
              nro_documento: true,
              area: { select: { nombre: true } },
              cargo: { select: { nombre: true } },
            },
          },
        },
      }),
    ]);

    const proximosAVencer = contratos.map((contrato) => {
      const fechaFin = contrato.fecha_fin.toISOString().slice(0, 10);
      const diasRestantes = diferenciaDiasSimples(fechas.fechaCorte, fechaFin);
      return {
        id: contrato.id,
        empleado_id: contrato.empleado_id,
        colaborador:
          `${contrato.empleados.nombre} ${contrato.empleados.apellido}`.trim(),
        nro_documento: contrato.empleados.nro_documento,
        area: contrato.empleados.area?.nombre ?? 'Sin Área',
        cargo: contrato.empleados.cargo?.nombre ?? 'Sin Cargo',
        fecha_fin: fechaFin,
        dias_restantes: diasRestantes,
        nivel_alerta:
          diasRestantes <= DIAS_ALERTA_CRITICA
            ? ('CRITICO' as const)
            : ('PREVENTIVO' as const),
      };
    });

    return {
      total_por_vencer_30d: criticos15d + preventivos30d,
      criticos_15d: criticos15d,
      preventivos_30d: preventivos30d,
      proximos_a_vencer: proximosAVencer,
    };
  }

  private async obtenerSolicitudesTramite(): Promise<
    DashboardRrhhResponseDto['solicitudes_tramite']
  > {
    const where: Prisma.solicitudWhereInput = {
      deleted_at: null,
      estado: {
        in: [EstadoSolicitud.PENDIENTE, EstadoSolicitud.EN_REVISION],
      },
    };

    const [gruposPorTipo, proximas] = await Promise.all([
      this.prisma.solicitud.groupBy({
        by: ['tipo'],
        where,
        _count: { _all: true },
      }),
      this.prisma.solicitud.findMany({
        where,
        take: DASHBOARD_RRHH_LIMITE_LISTA,
        orderBy: [
          { fecha_limite: { sort: 'asc', nulls: 'last' } },
          { created_at: 'asc' },
          { id: 'asc' },
        ],
        select: {
          id: true,
          codigo: true,
          empleado_id: true,
          tipo: true,
          estado: true,
          fecha_inicio: true,
          fecha_fin: true,
          hora_inicio: true,
          hora_fin: true,
          dias_solicitados: true,
          fecha_limite: true,
          created_at: true,
          empleados: {
            select: {
              nombre: true,
              apellido: true,
              area: { select: { nombre: true } },
            },
          },
        },
      }),
    ]);

    const porTipo = gruposPorTipo
      .map((grupo) => ({
        tipo: grupo.tipo,
        cantidad: grupo._count._all,
      }))
      .sort((a, b) => b.cantidad - a.cantidad || a.tipo.localeCompare(b.tipo));

    const totalPendientes = porTipo.reduce(
      (acumulado, grupo) => acumulado + grupo.cantidad,
      0
    );

    return {
      total_pendientes: totalPendientes,
      por_tipo: porTipo,
      proximas: proximas.map((solicitud) => ({
        id: solicitud.id,
        codigo: solicitud.codigo,
        empleado_id: solicitud.empleado_id,
        tipo: solicitud.tipo,
        estado: solicitud.estado,
        colaborador:
          `${solicitud.empleados.nombre} ${solicitud.empleados.apellido}`.trim(),
        area: solicitud.empleados.area?.nombre ?? 'Sin Área',
        fecha_inicio: solicitud.fecha_inicio
          ? solicitud.fecha_inicio.toISOString().slice(0, 10)
          : null,
        fecha_fin: solicitud.fecha_fin
          ? solicitud.fecha_fin.toISOString().slice(0, 10)
          : null,
        hora_inicio: solicitud.hora_inicio,
        hora_fin: solicitud.hora_fin,
        dias_solicitados: solicitud.dias_solicitados,
        fecha_limite: solicitud.fecha_limite
          ? solicitud.fecha_limite.toISOString().slice(0, 10)
          : null,
        created_at: solicitud.created_at.toISOString(),
      })),
    };
  }
}
