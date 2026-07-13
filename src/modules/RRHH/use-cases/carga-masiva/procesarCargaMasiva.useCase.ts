//src/modules/RRHH/use-cases/empleado/procesarCargaMasiva.useCase.ts
//Caso de uso para procesar la carga masiva de empleados desde un archivo CSV
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CargaMasivaFilaSchema, CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import * as csvParser from 'csv-parser';
import { Readable } from 'node:stream';

@Injectable()
export class ProcesarCargaMasivaUseCase {

    constructor(
        @InjectQueue('rrhh-bulk-queue') private readonly rrhhBulkQueue: Queue, //Inyecta la cola de procesamiento de carga masiva
        private readonly prisma: PrismaService //Inyecta el servicio de Prisma para interactuar con la base de datos
    ) {}

    //Metodo para ejecutar el caso de uso
    async execute(jobId: string, usuarioId: string, archivoStream: Readable): Promise<void> {
    // Inicializar el Job en la tabla física de la base de datos
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
        return new Promise((resolve, reject) => {
            let loteActual: CargaMasivaFilaDTO[] = [];
            let registrosContados = 0;
            let indexLote = 0;

            //Transmision de datos desde el archivo CSV
            archivoStream
                .pipe(csvParser.default({ separator: ',' }))
                .on('data', async (fila: any) => {
                    registrosContados++;

                    const validacion = CargaMasivaFilaSchema.safeParse(fila);
                    if(validacion.success) loteActual.push(validacion.data);

                    if(loteActual.length === 50 ) {
                        archivoStream.pause(); //Pausar la transmisión de datos mientras se procesa el lote actual

                        await this.rrhhBulkQueue.add(`lote-${indexLote++}`, {
                            jobId,
                            registros: loteActual
                        }, { removeOnComplete: true });

                        loteActual = []; //Reiniciar el lote actual
                        archivoStream.resume(); //Reanudar la transmisión de datos
                    }
                })
                .on('end', async () => {
                    if(loteActual.length > 0 ) await this.rrhhBulkQueue.add(`lote-final`, {
                        jobId,
                        registros: loteActual
                    });

                    await this.prisma.cargaMasivaJob.update({
                        where: { id: jobId },
                        data: { total_registros: registrosContados }
                    });

                    resolve();
                })
                .on('error', (error) => {
                    reject(error);
                });
        })
    }

    //Metodo para manejar errores en el procesamiento del job de carga masiva
    handleJobFailure(jobId: string, error: any) {
        this.prisma.cargaMasivaJob.update({
            where: { id: jobId },
            data: {
                estado: 'FALLIDO',
                mensaje_error: error.message || 'Error desconocido durante el procesamiento de la carga masiva.'
            }
        }).catch((err) => {
            console.error(`Error al actualizar el estado del job ${jobId} a FALLIDO: ${err.message}`);
        });
    }
}
