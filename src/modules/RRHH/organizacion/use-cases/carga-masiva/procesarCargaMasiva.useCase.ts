//src/modules/RRHH/organizacion/use-cases/carga-masiva/procesarCargaMasiva.useCase.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@/common/prisma/prisma.service';
import {CargaMasivaFilaSchema, CargaMasivaFilaDTO} from '@jyp/shared-contracts';
import * as csvParser from 'csv-parser';
import { Readable } from 'node:stream';

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

  //Metodo para ejecutar el caso de uso
  async execute(
    jobId: string,
    usuarioId: string,
    archivoStream: Readable
  ): Promise<void> {
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
      const lotes: CargaMasivaFilaDTO[][] = [];
      let loteActual: CargaMasivaFilaDTO[] = [];
      let registrosContados = 0;

      // Parsear el stream del CSV usando un bucle asincrónico para respetar la contrapresión
      const parser = archivoStream.pipe(
        csvParser.default({
          separator: ',',
          mapHeaders: ({ header }) => header.replace(/^\ufeff/, '').trim()
        })
      );

      for await (const fila of parser) {
        registrosContados++;

        // Limpiar llaves y valores removiendo caracteres invisibles
        const filaLimpia: Record<string, any> = {};
        for (const [key, val] of Object.entries(fila)) {
          const cleanKey = key.replace(/^\ufeff/, '').trim();
          const cleanVal = typeof val === 'string' ? val.trim() : val;
          filaLimpia[cleanKey] = cleanVal;
        }

       // Sanitización previa: coercionar 'asig_familiar' de string ("true"/"false"/"1"/"0") a booleano real
        const asigVal = typeof fila.asig_familiar === 'string'
          ? fila.asig_familiar.trim().toLowerCase()
          : fila.asig_familiar;

        const esAsigFamiliar = asigVal === 'true' || asigVal === '1' || asigVal === true;

        const filaSanitizada = {
          ...fila,
          asig_familiar: esAsigFamiliar,
        };

        const validacion = CargaMasivaFilaSchema.safeParse(filaSanitizada);

        if (validacion.success) {
          loteActual.push(validacion.data);
        } else {
          // Si la validación falla por formato Zod, pasamos la fila sanitizada de todos modos
          // para que el worker de BullMQ intente procesarla y registre el fallo exacto en errores_detalle
          loteActual.push(filaSanitizada as CargaMasivaFilaDTO);
        }

        if (loteActual.length === 50) {
          lotes.push(loteActual);
          loteActual = [];
        }
      }

      if (loteActual.length > 0) 
        lotes.push(loteActual);
      

      this.logger.log(`Lectura de CSV completada. Total de filas contadas: ${registrosContados}. Lotes generados: ${lotes.length}`);

      // 2. OBLIGATORIO: Actualizar el total de registros en PostgreSQL ANTES de encolar
      // Esto elimina la condición de carrera donde el Worker lee total_registros = 0
      await this.prisma.cargaMasivaJob.update({
        where: { id: jobId },
        data: { total_registros: registrosContados },
      });

      // 3. Enviar los lotes a BullMQ una vez fijado el total de registros en BD
      for (let index = 0; index < lotes.length; index++) {
        const esUltimo = index === lotes.length - 1;
        const nombreLote = esUltimo ? 'lote-final' : `lote-${index}`;

        await this.rrhhBulkQueue.add(
          nombreLote,
          { jobId, registros: lotes[index] },
          { removeOnComplete: true },
        );
      }

      this.logger.log(`Job ${jobId} encolado exitosamente en BullMQ.`);
    } catch (error: any) {
      this.logger.error(`Error al procesar el archivo CSV del job ${jobId}: ${error.message}`, error.stack);
      await this.handleJobFailure(jobId, error);
      throw error;
    }
  }

  async handleJobFailure(jobId: string, error: any): Promise<void> {
    try {
      await this.prisma.cargaMasivaJob.update({
        where: { id: jobId },
        data: {
          estado: 'FALLIDO',
          errores_detalle: {
            error_critico: error.message || 'Error desconocido durante la lectura del CSV.',
          },
        },
      });
    } catch (err: any) {
      this.logger.error(`Error al actualizar el estado del job ${jobId} a FALLIDO: ${err.message}`, err.stack);
    }
  }
}