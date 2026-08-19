//src/workers/carga-masiva/carga-masiva.processor.ts
//Worker para procesar la carga masiva de empleados desde un archivo CSV
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ProcesarFilaEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase';
import { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import { Logger } from '@nestjs/common';

/**
 * Processor de BullMQ para manejar la carga masiva de empleados desde un archivo CSV.
 * Procesa cada fila del archivo CSV de manera asíncrona, 
 * actualizando el estado del job en la base de datos y registrando los errores ocurridos durante el procesamiento.
 * @requires - PrismaService para interactuar con la base de datos.
 * @requires - ProcesarFilaEmpleadoUseCase para procesar cada fila del CSV.
 */
@Processor('rrhh-bulk-queue')
export class CargaMasivaProcessor extends WorkerHost {
  private readonly logger = new Logger(CargaMasivaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly procesarFilaEmpleadoUseCase: ProcesarFilaEmpleadoUseCase,
  ) {
    super();
    this.logger.log("🚀 Worker de Carga Masiva (rrhh-bulk-queue) inicializado y escuchando trabajos en Redis.");
  }

  /**
   * Método que se ejecuta cuando un job es procesado.
   * @param job - Job que contiene el ID del job y las filas del CSV a procesar.
   * @returns - Promesa que se resuelve cuando todas las filas han sido procesadas.
   * @throws - Actualiza el estado del job a "FALLIDO" si ocurre un error durante el procesamiento.
   */
 
  async process(job: Job<{ jobId: string; registros: CargaMasivaFilaDTO[] }> ): Promise<void> {
    const { jobId, registros } = job.data;
    this.logger.log(`[Job ${jobId}] Procesando lote '${job.name}' con ${registros.length} registros...`);


    //Transicionar el estado del job a "PROCESANDO"
    await this.prisma.cargaMasivaJob.update({
      where: { id: jobId },
      data: { estado: 'PROCESANDO' }
    });

    //Inicializar contadores para el seguimiento de los resultados del procesamiento
    let exitososEnEsteLote = 0;
    let fallidosEnEsteLote = 0;
    const nuevosErrores: Array<{ Dni: string; causa: string }> = [];

    //Procesar cada registro del CSV
    for (const fila of registros) {
      try {
        await this.procesarFilaEmpleadoUseCase.execute(fila, jobId);
        exitososEnEsteLote++;
      } catch (error: any) {
        fallidosEnEsteLote++;
        nuevosErrores.push({
          Dni: fila.nro_documento || 'SIN_DOCUMENTO',
          causa: error.message || 'Fallo transaccional durante la inserción',
        });
      }
    }
    
    //Actualizar el estado del job con los resultados del procesamiento
    const jobActual = await this.prisma.cargaMasivaJob.findUnique({where: { id: jobId }});
    if (!jobActual) return;

    const totalProcesados = jobActual.procesados + exitososEnEsteLote;
    const totalFallidos = jobActual.fallidos + fallidosEnEsteLote;
    const totalAtendidos = totalProcesados + totalFallidos;

    //Verificar si con este lote ya se cubrio la totalidad de registros y actualizar el estado del job en consecuencia
    const finalizado = jobActual.total_registros > 0 && totalAtendidos >= jobActual.total_registros;


    //Mantener el historial de errores previos y agregar los nuevos errores ocurridos en este lote
    const erroresPrevios = Array.isArray(jobActual.errores_detalle) ? (jobActual.errores_detalle as Array<any>) : [];
    const listaErroresActualizada = [...erroresPrevios, ...nuevosErrores];

    let nuevoEstado: 'PROCESANDO' | 'COMPLETADO' | 'FALLIDO' = 'PROCESANDO';
    if (finalizado) {
      nuevoEstado = totalProcesados === 0 && totalFallidos > 0 ? 'FALLIDO' : 'COMPLETADO';
      this.logger.log(`✅ [Job ${jobId}] Finalizado con estado: ${nuevoEstado}. Procesados: ${totalProcesados}, Fallidos: ${totalFallidos}`);
    }

    await this.prisma.cargaMasivaJob.update({
      where: { id: jobId },
      data: {
        procesados: totalProcesados,
        fallidos: totalFallidos,
        errores_detalle: listaErroresActualizada,
        estado: nuevoEstado
      }
    });
  }
}
