import { PrismaService } from "@/common/prisma/prisma.service";
import { InjectQueue } from "@nestjs/bullmq";
import { BadRequestException, Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { leerArchivoExcel } from "./helper/cargaMasiva";
import { IdentityGenerator } from "@/common/utils/uuid.util";

@Injectable()
export class confirmarCargaMasiva{
    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue('asistencia-bulk-queue') private readonly asistenciaQueue: Queue,
    ){}

    async execute(idUser:string, buffer: Buffer){
        const { filasValidas, filasConError } = await leerArchivoExcel(buffer);
        if (filasValidas.length === 0) {
            throw new BadRequestException('El archivo no contiene filas válidas para procesar');
        }
        const job = await this.prisma.cargaMasivaJob.create({
            data: {
                id: IdentityGenerator.generateId(),
                usuario_id: idUser,
                total_registros: filasValidas.length,
                estado: 'EN_COLA', 
                procesados: 0,
                fallidos: 0,
            },
        });

        await this.asistenciaQueue.add('procesar-lote-asistencia', {
            jobId: job.id,
            registros: filasValidas,
        });

        return {
            jobId: job.id,
            filasRecibidas: filasValidas.length + filasConError.length,
            filasValidas: filasValidas.length,
            filasConErrorDeFormato: filasConError.length,
            mensaje: 'Archivo recibido, procesando en segundo plano',
        };
    }
}