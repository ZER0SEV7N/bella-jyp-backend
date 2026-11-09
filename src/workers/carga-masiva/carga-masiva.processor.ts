//src/workers/carga-masiva/carga-masiva.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ProcesarFilaEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase';
import { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import { Logger, Optional } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { CLS_USER_ID } from '@/common/cls/cls.constants';

/**
 * Processor de BullMQ para la carga masiva de empleados (`rrhh-bulk-queue`).
 * - Propaga el `usuario_id` del job al contexto CLS (`AUD-F5`) para que las inserciones/actualizaciones
 *   queden asociadas al usuario que inició la carga masiva en `audit_log`.
 * - Utiliza incrementos atómicos y sanitiza los mensajes de error en `errores_detalle` (`CMA-F5`, `COM-F2`).
 */
@Processor('rrhh-bulk-queue')
export class CargaMasivaProcessor extends WorkerHost {
  private readonly logger = new Logger(CargaMasivaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly procesarFilaEmpleadoUseCase: ProcesarFilaEmpleadoUseCase,
    @Optional() private readonly cls?: ClsService,
  ) {
    super();
    this.logger.log('Worker de Carga Masiva (rrhh-bulk-queue) inicializado y escuchando trabajos en Redis.');
  }

  async process(job: Job<{ jobId: string; usuarioId?: string; registros: CargaMasivaFilaDTO[] }> ): Promise<void> {
    const { jobId, registros } = job.data;
    this.logger.log(`[Job ${jobId}] Procesando lote '${job.name}' con ${registros.length} registros...`);

    const jobMeta = await this.prisma.cargaMasivaJob.update({
      where: { id: jobId },
      data: { estado: 'PROCESANDO' },
    });

    const usuarioResponsableId = job.data.usuarioId ?? (jobMeta as any)?.usuario_id ?? null;

    const ejecutarLote = async () => {
      if (this.cls && usuarioResponsableId) {
        this.cls.set(CLS_USER_ID, usuarioResponsableId);
      }

      let exitososEnEsteLote = 0;
      let fallidosEnEsteLote = 0;
      const nuevosErrores: Array<{ Dni: string; causa: string }> = [];

      for (const fila of registros) {
        try {
          await this.procesarFilaEmpleadoUseCase.execute(fila, jobId);
          exitososEnEsteLote++;
        } catch (error: any) {
          fallidosEnEsteLote++;
          const dniRow = fila.nro_documento || (fila as any).dni || (fila as any).numero_documento || 'SIN_DOCUMENTO';
          const causaBruta = error?.message || 'Fallo transaccional durante la inserción';
          const causaError = /Invalid `.*prisma|Unique constraint failed/i.test(causaBruta)
            ? 'Conflicto de datos o formato inválido al registrar el colaborador.'
            : causaBruta;

          this.logger.warn(`[Job ${jobId}] Error en fila (DNI: ${dniRow}): ${causaBruta}`);
          nuevosErrores.push({
            Dni: dniRow,
            causa: causaError,
          });
        }
      }

      await this.prisma.$transaction(async (tx) => {
        const jobActual = await tx.cargaMasivaJob.findUnique({ where: { id: jobId } });

        if (!jobActual) return;

        const totalProcesados = jobActual.procesados + exitososEnEsteLote;
        const totalFallidos = jobActual.fallidos + fallidosEnEsteLote;
        const totalAtendidos = totalProcesados + totalFallidos;

        const erroresPrevios = Array.isArray(jobActual.errores_detalle)
          ? (jobActual.errores_detalle as Array<any>)
          : [];

        const listaErroresActualizada = [...erroresPrevios, ...nuevosErrores];

        const finalizado = jobActual.total_registros > 0 && totalAtendidos >= jobActual.total_registros;

        let nuevoEstado: 'PROCESANDO' | 'COMPLETADO' | 'FALLIDO' =
          jobActual.estado === 'COMPLETADO' ? 'COMPLETADO' : 'PROCESANDO';

        if (finalizado) {
          nuevoEstado = totalProcesados === 0 && totalFallidos > 0 ? 'FALLIDO' : 'COMPLETADO';
          this.logger.log(`[Job ${jobId}] Procesamiento finalizado. Estado: ${nuevoEstado}. Éxitos: ${totalProcesados}, Fallos: ${totalFallidos}.`);
        }

        await tx.cargaMasivaJob.update({
          where: { id: jobId },
          data: {
            procesados: totalProcesados,
            fallidos: totalFallidos,
            errores_detalle: listaErroresActualizada,
            estado: nuevoEstado,
          },
        });
      });
    };

    if (this.cls && typeof this.cls.run === 'function') {
      await this.cls.run(ejecutarLote);
    } else {
      await ejecutarLote();
    }
  }
}