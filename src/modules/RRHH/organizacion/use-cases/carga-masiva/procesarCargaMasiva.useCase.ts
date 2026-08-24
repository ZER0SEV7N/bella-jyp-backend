//src/modules/RRHH/organizacion/use-cases/carga-masiva/procesarCargaMasiva.useCase.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@/common/prisma/prisma.service';
import {CargaMasivaFilaSchema, CargaMasivaFilaDTO} from '@jyp/shared-contracts';
import * as csvParser from 'csv-parser';
import { Readable } from 'node:stream';
import { ParseExcelBuffer, ParseCsvBuffer, MapearFilaRaw} from './helpers/cargaMasiva.helpers';

/**
 * Caso de uso para procesar la carga masiva de empleados desde un archivo CSV.
 * Este caso de uso divide el archivo en lotes y los envía a una cola para su procesamiento asincrónico.
 * Cada lote es procesado por un worker que ejecuta el caso de uso ProcesarFilaEmpleadoUseCase.
 * La operación es atómica y está gobernada por la extensión de auditoría de Prisma.
 */
@Injectable()
export class ProcesarCargaMasivaUseCase {
  private readonly logger = new Logger(ProcesarCargaMasivaUseCase.name);

  constructor(
    @InjectQueue('rrhh-bulk-queue') 
    private readonly rrhhBulkQueue: Queue, //Inyecta la cola de procesamiento de carga masiva
    private readonly prisma: PrismaService, //Inyecta el servicio de Prisma para interactuar con la base de datos
  ) {}

  /**
   * Ejecuta el caso de uso para procesar la carga masiva de empleados.
   * @param jobId - El ID del job de carga masiva.
   * @param usuarioId - El ID del usuario que realiza la carga.
   * @param archivoStream - El stream del archivo a procesar.
   * @param filename - El nombre del archivo.
   * @param mimeType - El tipo MIME del archivo.
   * @returns Una promesa que se resuelve cuando se completa el procesamiento.
   */
  async execute(jobId: string, usuarioId: string, archivoStream: Readable, filename = 'archivo.csv', mimeType = 'text/csv' ): Promise<void> {
    this.logger.log(`Iniciando ingesta de carga masiva para Job ${jobId}...`);
    
    //Inicializar el Job en la tabla física de la base de datos
    await this.prisma.cargaMasivaJob.create({
      data: {
        id: jobId,
        usuario_id: usuarioId,
        estado: 'EN_COLA',
        total_registros: 0,
        procesados: 0,
        fallidos: 0
      }
    });

    //Retorna una promesa que se resuelve cuando se completa el procesamiento del archivo CSV
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of archivoStream) 
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      
      const bufferCompleto = Buffer.concat(chunks);
      if (bufferCompleto.length === 0) 
        throw new BadRequestException('El archivo está completamente vacío.');

      const esExcel = filename.toLowerCase().endsWith('.xlsx') || mimeType.includes('spreadsheetml') || mimeType.includes('excel');
      let filasRaw: Record<string, any>[] = [];
      if (esExcel) 
        filasRaw = await ParseExcelBuffer(bufferCompleto);
      else 
        filasRaw = await ParseCsvBuffer(bufferCompleto);

      const lotes: CargaMasivaFilaDTO[][] = [];
      let loteActual: CargaMasivaFilaDTO[] = [];
      let registrosContados = 0;

      for await (const fila of filasRaw) {
        registrosContados++;

        const filaSanitizada = MapearFilaRaw(fila);
        const validacion = CargaMasivaFilaSchema.safeParse(filaSanitizada);

        if (validacion.success) loteActual.push(validacion.data);
        else loteActual.push(filaSanitizada as CargaMasivaFilaDTO);

        if (loteActual.length === 50) {
          lotes.push(loteActual);
          loteActual = [];
        }
      }

      if (loteActual.length > 0) 
        lotes.push(loteActual);
      

      this.logger.log(`Lectura completada. Total de filas contadas: ${registrosContados}. Lotes generados: ${lotes.length}`);

      //Fijar total de registros en PostgreSQL antes de encolar
      await this.prisma.cargaMasivaJob.update({
        where: { id: jobId },
        data: { total_registros: registrosContados }
      });

      //Encolar lotes en BullMQ
      for (let index = 0; index < lotes.length; index++) {
        const esUltimo = index === lotes.length - 1;
        const nombreLote = esUltimo ? 'lote-final' : `lote-${index}`;

        await this.rrhhBulkQueue.add(
          nombreLote,
          { jobId, registros: lotes[index] },
          { removeOnComplete: true }
        );
      }

      this.logger.log(`Job ${jobId} encolado exitosamente en BullMQ.`);
    } catch (error: any) {
      this.logger.error(`Error al procesar la carga masiva del job ${jobId}: ${error.message}`, error.stack);
      await this.handleJobFailure(jobId, error);
      throw error;
    }
  }

  /**
   * Maneja la falla de un job de carga masiva actualizando su estado a FALLIDO en la base de datos.
   * Si ocurre un error al actualizar el estado, se registra en el logger pero no se lanza una excepción adicional.
   * @param jobId - El ID del job de carga masiva que falló.
   * @param error - El error que causó la falla del job.
   * @returns Una promesa que se resuelve cuando se completa la actualización del estado del job.
   */
  async handleJobFailure(jobId: string, error: any): Promise<void> {
    try {
      await this.prisma.cargaMasivaJob.update({
        where: { id: jobId },
        data: {
          estado: 'FALLIDO',
          errores_detalle: { error_critico: error.message || 'Error desconocido durante la lectura del CSV.', stack: error.stack || null }
        }
      });
    } catch (err: any) {
      this.logger.error(`Error al actualizar el estado del job ${jobId} a FALLIDO: ${err.message}`, err.stack);
    }
  }
}