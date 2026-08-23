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
      const chunks: Buffer[] = [];
      for await (const chunk of archivoStream) 
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      
      const bufferCompleto = Buffer.concat(chunks);

      // Decodificación inteligente: Intentar UTF-8 estricto, fallback a Windows-1252 de Excel
      let textoDecodificado: string;
      try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        textoDecodificado = utf8Decoder.decode(bufferCompleto);
      } catch {
        this.logger.warn(`Detectado CSV codificado en Windows-1252/ANSI (Excel en español). Decodificando...`);
        const winDecoder = new TextDecoder('windows-1252');
        textoDecodificado = winDecoder.decode(bufferCompleto);
      }

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

       // Detectar si Excel exportó una sola columna unida por punto y coma (;)
        const rawKeys = Object.keys(fila);
        const filaLimpia: Record<string, any> = {};

        if (rawKeys.length === 1 && rawKeys[0].includes(';')) {
          // El encabezado viene unido con punto y coma
          const headersArr = rawKeys[0].split(';').map((h) => h.replace(/^\ufeff/, '').trim());
          const valString = String(Object.values(fila)[0] || '');
          const valuesArr = valString.split(';').map((v) => v.trim());

          headersArr.forEach((h, idx) => {
            filaLimpia[h] = valuesArr[idx] !== undefined ? valuesArr[idx] : '';
          });
        } else {
          // El CSV viene delimitado por comas normales
          for (const [key, val] of Object.entries(fila)) {
            const cleanKey = key.replace(/^\ufeff/, '').trim();
            const cleanVal = typeof val === 'string' ? val.trim() : val;
            filaLimpia[cleanKey] = cleanVal;
          }
        }

        const nroDoc = (
          filaLimpia.nro_documento ||
          filaLimpia.numero_documento ||
          filaLimpia.dni ||
          filaLimpia.nro_doc ||
          filaLimpia.documento ||
          ''
        ).toString().trim();

        const tipoDoc = (
          filaLimpia.tipo_documento ||
          filaLimpia.tipo_doc ||
          'DNI'
        ).toString().trim();

        const nombre = (
          filaLimpia.nombre ||
          filaLimpia.nombres ||
          ''
        ).toString().trim();

        const apellido = (
          filaLimpia.apellido ||
          filaLimpia.apellidos ||
          ''
        ).toString().trim();

        const area = (
          filaLimpia.area ||
          filaLimpia.departamento ||
          ''
        ).toString().trim();

        const cargo = (
          filaLimpia.cargo ||
          filaLimpia.puesto ||
          ''
        ).toString().trim();

        const jornada = (
          filaLimpia.jornada ||
          filaLimpia.turno ||
          filaLimpia.horario ||
          ''
        ).toString().trim();

        const fechaNac = (
          filaLimpia.fecha_nacimiento ||
          filaLimpia.fec_nac ||
          ''
        ).toString().trim();

        // Sanitizar asignación familiar (string "true"/"false"/"1"/"0" a boolean)
        const rawAsig = filaLimpia.asig_familiar;
        const asigVal = typeof rawAsig === 'string' ? rawAsig.toLowerCase().trim() : rawAsig;
        const esAsigFamiliar = asigVal === 'true' || asigVal === '1' || asigVal === true;

        const filaSanitizada = {
          tipo_documento: tipoDoc,
          nro_documento: nroDoc,
          nombre,
          apellido,
          area,
          cargo,
          jornada,
          fecha_nacimiento: fechaNac,
          asig_familiar: esAsigFamiliar,
        };

        const validacion = CargaMasivaFilaSchema.safeParse(filaSanitizada);

        if (validacion.success) 
          loteActual.push(validacion.data);
        else 
          // Si la validación falla por formato Zod, pasamos la fila sanitizada de todos modos
          // para que el worker de BullMQ intente procesarla y registre el fallo exacto en errores_detalle
          loteActual.push(filaSanitizada as CargaMasivaFilaDTO);

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
        data: { total_registros: registrosContados }
      });

      // 3. Enviar los lotes a BullMQ una vez fijado el total de registros en BD
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