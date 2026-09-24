//src/modules/RRHH/solicitudes/use-cases/anularSolicitud.useCase.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Caso de uso para anular una solicitud de RRHH.
 * Este caso de uso tiene como objetivo permitir a los usuarios con los roles adecuados (ADMIN, RRHH) 
 * anular una solicitud de RRHH proporcionando un comentario obligatorio que explique la razón de la anulación.
 */
@Injectable()
export class AnularSolicitudUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para anular una solicitud de RRHH.
     * @param solicitudId - El ID de la solicitud a anular.
     * @param motivoAnulacion - El motivo o comentario que explica la razón de la anulación. 
     * Este campo es obligatorio y debe contener al menos 5 caracteres.
     * @returns La solicitud actualizada con el estado 'ANULADA' y la observación correspondiente.
     * @throws {NotFoundException} Si la solicitud no existe o ha sido eliminada.
     * @throws {BadRequestException} Si la solicitud ya fue aprobada o si el motivo de anulación es inválido.
     */
    async execute(solicitudId: string, motivoAnulacion: string) {
        const solicitud = await this.prisma.solicitud.findUnique({ where: { id: solicitudId, deleted_at: null } });

        if(!solicitud) throw new NotFoundException('La solicitud especificada no existe o ha sido eliminada.');

        if(solicitud.estado === 'APROBADA') throw new BadRequestException('No se puede anular una solicitud que ya fue formalmente aprobada.');

        return await this.prisma.solicitud.update({
            where: { id: solicitudId },
            data: {
                estado: 'ANULADA',
                observacion: motivoAnulacion.trim() ? `[ANULADA]: ${motivoAnulacion.trim()}` : solicitud.observacion,
                deleted_at: new Date() //Marca la solicitud como eliminada
            }
        });
    }
}