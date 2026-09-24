//src/modules/RRHH/organizacion/use-cases/carga-masiva/confirmarCargaMasiva.useCase.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';

/**
 * DTO de entrada para confirmar el procesamiento de las filas pre-validadas.
 */
export interface ConfirmarCargaMasivaDTO {
    filas?: CargaMasivaFilaDTO[];
    filas_validas_data?: CargaMasivaFilaDTO[];
}

/**
 * Caso de uso para confirmar la carga masiva de empleados.
 * - Recibe las filas pre-validadas y las encola para procesamiento asincrónico.
 * - Actualiza el estado del job a "EN_PROCESO" y registra el total de registros.
 * - La operación es atómica y está gobernada por la extensión de auditoría de Prisma.
 */
@Injectable()
export class ConfirmarCargaMasivaUseCase {
    private readonly logger = new Logger(ConfirmarCargaMasivaUseCase.name);

    constructor(
        @InjectQueue('rrhh-bulk-queue')
        private readonly rrhhBulkQueue: Queue,
        private readonly prisma: PrismaService,
    ) {}

    async execute(usuarioId: string, payload: any): Promise<{ jobId: string }> {
       let filasAProcesar: CargaMasivaFilaDTO[] = [];

        if (Array.isArray(payload)) {
        filasAProcesar = payload;
        } else if (payload && typeof payload === 'object') {
        filasAProcesar = payload.filas_validas_data || payload.filas || [];
        }

        if (!Array.isArray(filasAProcesar) || filasAProcesar.length === 0) {
        throw new BadRequestException('No hay filas válidas proporcionadas para procesar.');
        }
        
        const jobId = IdentityGenerator.generateId();
        const totalRegistros = filasAProcesar.length;

        this.logger.log(`[ConfirmarCargaMasiva] Inicializando Job ${jobId} con ${totalRegistros} registros validados...`);

        //Crear el Job en PostgreSQL en estado EN_COLA
        await this.prisma.cargaMasivaJob.create({
            data: {
                id: jobId,
                usuario_id: usuarioId,
                estado: 'EN_COLA',
                total_registros: totalRegistros,
                procesados: 0,
                fallidos: 0
            }
        });

        //Dividir las filas en lotes de 50 registros
        const tamañoLote = 50;
        const lotes: CargaMasivaFilaDTO[][] = [];

        for (let i = 0; i < filasAProcesar.length; i += tamañoLote) 
            lotes.push(filasAProcesar.slice(i, i + tamañoLote));
        

        //Encolar los lotes en BullMQ
        for (let index = 0; index < lotes.length; index++) {
            const esUltimo = index === lotes.length - 1;
            const nombreLote = esUltimo ? 'lote-final' : `lote-${index}`;

            await this.rrhhBulkQueue.add(
                nombreLote,
                { jobId, registros: lotes[index] },
                { removeOnComplete: true }
            );
        }

        this.logger.log(`[ConfirmarCargaMasiva] Job ${jobId} encolado exitosamente con ${lotes.length} lotes.`);
        return { jobId };
    }
}