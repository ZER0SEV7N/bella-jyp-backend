//src/modules/RRHH/use-cases/carga-masiva/consultarEstadoCargaMasiva.useCase.ts
//Caso de uso para consultar el estado de una carga masiva de empleados
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class ConsultarEstadoCargaMasivaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta una consulta ligera de solo lectura.
     */
    async execute(jobId: string, usuarioId: string) {
        const job = await this.prisma.cargaMasivaJob.findFirst({
            where: { 
                id: jobId,
                usuario_id: usuarioId // Medida de seguridad: un RRHH solo puede ver sus propios jobs
            },
            select: {
                id: true,
                estado: true,
                total_registros: true,
                procesados: true,
                fallidos: true,
                errores_detalle: true,
                updated_at: true
            }
        });

        if (!job) throw new NotFoundException(`El lote de carga masiva con ID ${jobId} no existe o no te pertenece.`);

        return job;
    }
}