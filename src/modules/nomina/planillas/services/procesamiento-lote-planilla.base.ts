// src/modules/nomina/planillas/services/procesamiento-lote-planilla.base.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import type { JobPayrollData } from '@/workers/calculo-masivo/payroll.processor';
import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Job } from 'bullmq';
import { GenerarPlanillaUseCase } from '../use-case/planillas/generarPlanilla.useCase';

/** Detalle acotado de un error de negocio ocurrido al calcular un colaborador. */
export type ErrorEmpleado = { empleado_id: string; detalle: string };

/**
 * Resultado de procesar un colaborador dentro del lote.
 * `OMITIDA_POR_ESTADO` indica que su planilla ya estaba congelada o declarada y no se recalculó (PLA-F6).
 */
export type ResultadoEmpleado =
  | { tipo: 'PROCESADA' }
  | { tipo: 'OMITIDA_POR_ESTADO' }
  | { tipo: 'ERROR'; error: ErrorEmpleado };

/** Acumulador mutable del progreso y resultado del cálculo masivo. */
export interface ResumenLotePlanilla {
  procesados: number;
  correctos: number;
  fallidos: number;
  omitidasPorEstado: number;
  errores: ErrorEmpleado[];
}

/** Fila precargada del historial de planillas para decidir si un colaborador se recalcula. */
type PlanillaPrevia = {
  empleado_id: string;
  estado: string;
  snapshot_calculo: Prisma.JsonValue | null;
};

const MAX_ERRORES_INFORME = 100;
const ESTADOS_INMUTABLES = new Set(['CONGELADO', 'DECLARADO']);

/**
 * Concurrencia por defecto del cálculo masivo. Coincide con los hilos de Piscina y se mantiene
 * por debajo del `DB_POOL_MAX` para dejar margen a las peticiones HTTP (Mejora 1 / RNF-01).
 */
export const CONCURRENCIA_DEFECTO = 4;

/**
 * Ejecuta `fn` sobre cada elemento manteniendo como máximo `limite` promesas en vuelo.
 * Sin dependencias externas y con el mismo orden de salida que la entrada.
 * @param items - Elementos a procesar.
 * @param limite - Máximo de operaciones concurrentes.
 * @param fn - Función asíncrona aplicada a cada elemento.
 * @returns - Resultados en el mismo orden que `items`.
 */
export async function mapConLimite<T, R>(
  items: T[],
  limite: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const resultados = new Array<R>(items.length);
  let siguiente = 0;

  const trabajadores = Array.from(
    { length: Math.max(1, Math.min(limite, items.length)) },
    async () => {
      while (siguiente < items.length) {
        const indice = siguiente++;
        resultados[indice] = await fn(items[indice]);
      }
    }
  );

  await Promise.all(trabajadores);
  return resultados;
}

/**
 * Clase base protegida con las operaciones unitarias y de lote del procesamiento masivo de planillas.
 * Separa el cálculo por colaborador y la construcción de filtros para mantener cohesivo el servicio orquestador.
 */
export abstract class ProcesamientoLotePlanillaBase {
  protected constructor(
    protected readonly prisma: PrismaService,
    protected readonly generarPlanilla: GenerarPlanillaUseCase,
    private readonly concurrencia: number = CONCURRENCIA_DEFECTO
  ) {}

  /**
   * Construye el filtro Prisma de colaboradores vigentes en el período solicitado.
   * @param data Datos del trabajo BullMQ (período, empleado y/o área).
   */
  protected construirFiltros({ dto }: JobPayrollData) {
    const { year, month } = ServerTime.validarPeriodo(dto.periodo);
    const inicio = ServerTime.desdeFechaSimple(`${dto.periodo}-01`);
    const fin = new Date(Date.UTC(year, month, 0));

    return {
      deleted_at: null,
      fecha_inicio: { lte: fin },
      OR: [{ fecha_cese: null }, { fecha_cese: { gte: inicio } }],
      ...(dto.empleado_id ? { id: dto.empleado_id } : {}),
      ...(dto.area_id ? { area_id: dto.area_id } : {}),
    };
  }

  /**
   * Procesa en paralelo un lote acotado de colaboradores con un tope de concurrencia.
   * Precarga el historial de planillas del lote en una sola consulta (Bulk Fetch) para erradicar
   * el patrón N+1 y actualiza el progreso del job una sola vez por lote.
   */
  protected async procesarLote(
    job: Job<JobPayrollData>,
    empleados: Array<{ id: string }>,
    total: number,
    resumen: ResumenLotePlanilla
  ): Promise<void> {
    const { periodo } = job.data.dto;

    // Precarga del lote: una consulta reemplaza a los findUnique por colaborador.
    const previas = await this.prisma.historial_planillas.findMany({
      where: { empleado_id: { in: empleados.map((e) => e.id) }, periodo },
      select: { empleado_id: true, estado: true, snapshot_calculo: true },
    });
    const mapa = new Map(previas.map((p) => [p.empleado_id, p]));

    const resultados = await mapConLimite(
      empleados,
      this.concurrencia,
      (empleado) => this.procesarEmpleado(job, empleado.id, mapa)
    );

    acumularResultadosLote(resumen, resultados);

    await job.updateProgress({
      total,
      procesados: resumen.procesados,
      correctos: resumen.correctos,
      fallidos: resumen.fallidos,
      omitidas_por_estado: resumen.omitidasPorEstado,
    });
  }

  /**
   * Genera la planilla de un colaborador individual, separando errores de negocio (4xx) de fallos técnicos (5xx).
   * @param mapa - Historial precargado del lote, indexado por `empleado_id`.
   * @throws Error si ocurre un fallo técnico para que BullMQ reintente el trabajo.
   */
  protected async procesarEmpleado(
    job: Job<JobPayrollData>,
    empleadoId: string,
    mapa: Map<string, PlanillaPrevia>
  ): Promise<ResultadoEmpleado> {
    const { dto, actor } = job.data;

    try {
      const anterior = mapa.get(empleadoId);

      // Una planilla congelada o declarada es inmutable: nunca se recalcula (PLA-F6).
      if (anterior && ESTADOS_INMUTABLES.has(anterior.estado)) {
        return { tipo: 'OMITIDA_POR_ESTADO' };
      }

      const snapshot =
        (anterior?.snapshot_calculo as { trabajo_id?: string } | null) ?? null;
      if (!anterior || snapshot?.trabajo_id !== job.id) {
        await this.generarPlanilla.execute(
          empleadoId,
          dto.periodo,
          actor,
          job.id
        );
      }

      return { tipo: 'PROCESADA' };
    } catch (error) {
      // Los errores técnicos se relanzan para reintento en BullMQ; los de negocio se registran por empleado.
      if (!(error instanceof HttpException) || error.getStatus() >= 500) {
        throw error;
      }

      return {
        tipo: 'ERROR',
        error: { empleado_id: empleadoId, detalle: error.message },
      };
    }
  }
}

/**
 * Acumula los resultados de un lote procesado en el resumen global, acotando el listado de errores.
 */
export function acumularResultadosLote(
  resumen: ResumenLotePlanilla,
  resultados: ResultadoEmpleado[]
): void {
  for (const resultado of resultados) {
    if (resultado.tipo === 'ERROR') {
      resumen.fallidos++;
      if (resumen.errores.length < MAX_ERRORES_INFORME) {
        resumen.errores.push(resultado.error);
      }
    } else {
      resumen.correctos++;
      if (resultado.tipo === 'OMITIDA_POR_ESTADO') {
        resumen.omitidasPorEstado++;
      }
    }
    resumen.procesados++;
  }
}

/**
 * Determina el estado final del trabajo según la cantidad de planillas correctas y fallidas.
 */
export function estadoResultado(correctos: number, fallidos: number): string {
  if (!fallidos) return 'COMPLETADO';
  return correctos ? 'PARCIAL' : 'FALLIDO';
}
