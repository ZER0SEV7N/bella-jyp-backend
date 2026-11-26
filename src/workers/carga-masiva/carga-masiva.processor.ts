//src/workers/carga-masiva/carga-masiva.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ProcesarFilaEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase';
import { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import { Logger, Optional } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { CLS_USER_ID } from '@/common/cls/cls.constants';
import { mapConLimite } from '@/common/utils/concurrencia.util';
import { prepararCatalogosCargaMasiva } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/helpers/catalogos-carga-masiva.helper';

/**
 * Concurrencia del procesamiento de filas de la carga masiva. Se mantiene por debajo del
 * `DB_POOL_MAX` para no agotar el pool y dejar margen a las peticiones HTTP.
 */
const CONCURRENCIA_CARGA_MASIVA = 5;

/** Resultado de procesar una fila dentro del lote. */
type ResultadoFila = { ok: true } | { ok: false; dni: string; causa: string };

/**
 * Processor de BullMQ para la carga masiva de empleados (`rrhh-bulk-queue`).
 * - Resuelve los catálogos una sola vez por job (Bulk Fetch) y procesa las filas en paralelo
 *   con un tope de concurrencia, eliminando el patrón N+1 y las esperas secuenciales.
 * - Propaga el `usuario_id` del job al contexto CLS (`AUD-F5`) para que las inserciones/actualizaciones
 *   queden asociadas al usuario que inició la carga masiva en `audit_log`.
 * - Sanitiza los mensajes de error en `errores_detalle` (`CMA-F5`, `COM-F2`).
 */
@Processor('rrhh-bulk-queue')
export class CargaMasivaProcessor extends WorkerHost {
  private readonly logger = new Logger(CargaMasivaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly procesarFilaEmpleadoUseCase: ProcesarFilaEmpleadoUseCase,
    @Optional() private readonly cls?: ClsService
  ) {
    super();
    this.logger.log(
      'Worker de Carga Masiva (rrhh-bulk-queue) inicializado y escuchando trabajos en Redis.'
    );
  }

  async process(
    job: Job<{
      jobId: string;
      usuarioId?: string;
      registros: CargaMasivaFilaDTO[];
    }>
  ): Promise<void> {
    const { jobId, registros } = job.data;
    this.logger.log(
      `[Job ${jobId}] Procesando lote '${job.name}' con ${registros.length} registros...`
    );

    const jobMeta = await this.prisma.cargaMasivaJob.update({
      where: { id: jobId },
      data: { estado: 'PROCESANDO' },
    });

    const usuarioResponsableId =
      job.data.usuarioId ??
      (jobMeta as { usuario_id?: string })?.usuario_id ??
      null;

    const ejecutarLote = async () => {
      if (this.cls && usuarioResponsableId) {
        this.cls.set(CLS_USER_ID, usuarioResponsableId);
      }

      //Se resuelven los catálogos una sola vez: las filas solo leen de memoria (sin N+1).
      const contexto = await prepararCatalogosCargaMasiva(
        this.prisma,
        registros
      );

      //Se procesan las filas en paralelo con un tope de concurrencia. Los errores se acotan
      //por fila para que una falla no detenga el lote.
      const resultados = await mapConLimite(
        registros,
        CONCURRENCIA_CARGA_MASIVA,
        async (fila): Promise<ResultadoFila> => {
          try {
            await this.procesarFilaEmpleadoUseCase.execute(
              fila,
              jobId,
              contexto
            );
            return { ok: true };
          } catch (error) {
            const dniRow =
              fila.nro_documento ||
              (fila as unknown as { dni?: string }).dni ||
              (fila as unknown as { numero_documento?: string })
                .numero_documento ||
              'SIN_DOCUMENTO';
            const causaBruta =
              (error as Error)?.message ||
              'Fallo transaccional durante la inserción';
            const causaError =
              /Invalid `.*prisma|Unique constraint failed/i.test(causaBruta)
                ? 'Conflicto de datos o formato inválido al registrar el colaborador.'
                : causaBruta;

            this.logger.warn(
              `[Job ${jobId}] Error en fila (DNI: ${dniRow}): ${causaBruta}`
            );
            return { ok: false, dni: dniRow, causa: causaError };
          }
        }
      );

      const exitososEnEsteLote = resultados.filter((r) => r.ok).length;
      const nuevosErrores = resultados
        .filter((r): r is { ok: false; dni: string; causa: string } => !r.ok)
        .map((r) => ({ Dni: r.dni, causa: r.causa }));
      const fallidosEnEsteLote = nuevosErrores.length;

      await this.prisma.$transaction(async (tx) => {
        const jobActual = await tx.cargaMasivaJob.findUnique({
          where: { id: jobId },
        });

        if (!jobActual) return;

        const totalProcesados = jobActual.procesados + exitososEnEsteLote;
        const totalFallidos = jobActual.fallidos + fallidosEnEsteLote;
        const totalAtendidos = totalProcesados + totalFallidos;

        const erroresPrevios = Array.isArray(jobActual.errores_detalle)
          ? (jobActual.errores_detalle as Array<{ Dni: string; causa: string }>)
          : [];

        const listaErroresActualizada: Array<{ Dni: string; causa: string }> = [
          ...erroresPrevios,
          ...nuevosErrores,
        ];

        const finalizado =
          jobActual.total_registros > 0 &&
          totalAtendidos >= jobActual.total_registros;

        let nuevoEstado: 'PROCESANDO' | 'COMPLETADO' | 'FALLIDO' =
          jobActual.estado === 'COMPLETADO' ? 'COMPLETADO' : 'PROCESANDO';

        if (finalizado) {
          nuevoEstado =
            totalProcesados === 0 && totalFallidos > 0
              ? 'FALLIDO'
              : 'COMPLETADO';
          this.logger.log(
            `[Job ${jobId}] Procesamiento finalizado. Estado: ${nuevoEstado}. Éxitos: ${totalProcesados}, Fallos: ${totalFallidos}.`
          );
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
