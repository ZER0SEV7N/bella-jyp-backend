//src/modules/RRHH/workers/carga-masiva/carga-masiva.processor.ts
//Worker para procesar la carga masiva de empleados desde un archivo CSV
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ProcesarFilaEmpleadoUseCase } from '@/modules/RRHH/use-cases/carga-masiva/procesarFila.useCase';
import { CargaMasivaFilaDTO } from '@jyp/shared-contracts';

//Processor para la cola de carga masiva de empleados
@Processor('rrhh-bulk-queue')
export class CargaMasivaProcessor extends WorkerHost {
    constructor (
        private readonly prisma: PrismaService, //Inyecta el servicio de Prisma para interactuar con la base de datos
        private readonly procesarFilaEmpleadoUseCase: ProcesarFilaEmpleadoUseCase //Inyecta el caso de uso para procesar cada fila del CSV
    ) {
        super()
    }

    //Metodo para procesar cada trabajo en la cola
    async process(job: Job<{ jobId: string, registros: CargaMasivaFilaDTO[] }>): Promise<void> {
        const { jobId, registros } = job.data;

        //Transicionar el estado del job a "PROCESANDO"
        await this.prisma.cargaMasivaJob.update({
            where: { id: jobId },
            data: { estado: 'PROCESANDO' }
        });

        //Procesar cada registro del CSV
        for (const fila of registros) {
            try {
                await this.procesarFilaEmpleadoUseCase.execute(fila, jobId);
            } catch (error: any){
                await this.prisma.cargaMasivaJob.update({
                    where: { id: jobId },
                    data: {
                        fallidos: { increment: 1 },
                        errores_detalle: {
                            push: { Dni: fila.nro_documento, causa: error.message || 'Fallo transaccional de disco' }
                        }
                    }
                });
            }
        }
    }
}