// src/modules/nomina/planillas/services/procesamiento-masivo-planilla.service.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import type { JobPayrollData } from '@/workers/calculo-masivo/payroll.processor';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { GenerarPlanillaUseCase } from '../use-case/planillas/generarPlanilla.useCase';
import {
  estadoResultado,
  ProcesamientoLotePlanillaBase,
  type ResumenLotePlanilla,
} from './procesamiento-lote-planilla.base';

const TAMANO_LOTE = 20;

/**
 * Servicio orquestador para el procesamiento masivo de planillas por cursor.
 * Delega el filtrado y la ejecución de lotes a `ProcesamientoLotePlanillaBase`.
 */
@Injectable()
export class ProcesamientoMasivoPlanillasService extends ProcesamientoLotePlanillaBase {
  constructor(prisma: PrismaService, generarPlanilla: GenerarPlanillaUseCase) {
    super(prisma, generarPlanilla);
  }

  /**
   * Procesa de manera masiva las planillas de los colaboradores que coinciden con los filtros del trabajo.
   * @param job Trabajo de BullMQ con período, filtros opcionales y actor.
   * @returns Resumen consolidado del estado, conteos y errores de negocio acotados.
   * @throws Error si no existen colaboradores dentro del período y los filtros solicitados.
   */
  async procesar(job: Job<JobPayrollData>) {
    const where = this.construirFiltros(job.data);

    const total = await this.prisma.empleados.count({ where });
    if (!total) {
      throw new Error(
        'No existen colaboradores dentro del período y los filtros solicitados.'
      );
    }

    const resumen: ResumenLotePlanilla = {
      procesados: 0,
      correctos: 0,
      fallidos: 0,
      omitidasPorEstado: 0,
      errores: [],
    };

    await this.procesarPagina(job, where, total, resumen);

    return {
      estado: estadoResultado(resumen.correctos, resumen.fallidos),
      total: resumen.procesados,
      correctos: resumen.correctos,
      fallidos: resumen.fallidos,
      omitidas_por_estado: resumen.omitidasPorEstado,
      errores: resumen.errores,
      errores_truncados: resumen.fallidos > resumen.errores.length,
    };
  }

  /**
   * Recorre las páginas de colaboradores por cursor de forma recursiva asíncrona.
   * Evita `await` dentro de bucles `while` (`typescript:S9382`) manteniendo memoria constante.
   */
  private async procesarPagina(
    job: Job<JobPayrollData>,
    where: ReturnType<ProcesamientoLotePlanillaBase['construirFiltros']>,
    total: number,
    resumen: ResumenLotePlanilla,
    cursor?: string
  ): Promise<void> {
    const empleados = await this.prisma.empleados.findMany({
      where,
      select: { id: true },
      orderBy: { id: 'asc' },
      take: TAMANO_LOTE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (!empleados.length) return;

    await this.procesarLote(job, empleados, total, resumen);

    const siguienteCursor = empleados.at(-1)?.id;
    if (siguienteCursor) {
      await this.procesarPagina(job, where, total, resumen, siguienteCursor);
    }
  }
}
