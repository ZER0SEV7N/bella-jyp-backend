//src/modules/rrhh/solicitudes/use-cases/evaluarSolicitud.useCase.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { EvaluarSolicitudDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para evaluar una solicitud de RRHH.
 * Este caso de uso tiene como objetivo permitir a los usuarios con los roles adecuados (ADMIN, RRHH) 
 * evaluar una solicitud de RRHH proporcionando el estado de la solicitud y un comentario opcional.
 */
@Injectable()
export class EvaluarSolicitudUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para evaluar una solicitud de RRHH.
     * @param solicitudId - El ID de la solicitud a evaluar.
     * @param dto - Los datos para evaluar la solicitud.
     */
    async execute(solicitudId: string, dto: EvaluarSolicitudDto, usuarioEvaluadorId: string) {
        const solicitud = await this.prisma.solicitud.findUnique({where: { id: solicitudId, deleted_at: null }});
        
        if(!solicitud) throw new NotFoundException('La solicitud especificada no existe o ha sido eliminada.');

        if(solicitud.estado === 'APROBADA' || solicitud.estado === 'RECHAZADA')
            throw new BadRequestException(`Esta solicitud ya fue dictaminada previamente como ${solicitud.estado}.`);

        if(dto.estado === 'RECHAZADA' && (!dto.observacion || dto.observacion.trim().length < 5)) 
           throw new BadRequestException('Debe ingresar un motivo u observación descriptiva para rechazar la solicitud.');

        return await this.prisma.solicitud.update({
            where: { id: solicitudId },
            data: {
                estado: dto.estado,
                observacion: dto.observacion ? dto.observacion.trim() : solicitud.observacion,
                responsable_id: usuarioEvaluadorId //Sella al usuario que dictamina
            },
            include: {
                empleado: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        nro_documento: true
                    }
                }
            }
        });
    }
}