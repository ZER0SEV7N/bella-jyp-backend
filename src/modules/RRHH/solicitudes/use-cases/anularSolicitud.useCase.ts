//src/modules/RRHH/solicitudes/use-cases/anularSolicitud.useCase.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { SOLICITUD_INCLUDE, construirCondicionActual, lanzarConflictoSiCambio, obtenerSolicitudOperativa, validarMotivo, validarSolicitudAbierta } from '../helpers/validacionesSolicitud.helper';


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
       const motivo = validarMotivo(motivoAnulacion, 'Motivo de anulación requerido');
        const solicitud = await obtenerSolicitudOperativa(this.prisma, solicitudId);
        validarSolicitudAbierta(solicitud);

        try {
            return await this.prisma.solicitud.update({
                where: construirCondicionActual(solicitud),
                // ANULADA es un estado de negocio; el registro continúa visible en detalle e historial.
                data: { estado: 'ANULADA', observacion: motivo },
                include: SOLICITUD_INCLUDE
            });
        } catch (error) {
            return lanzarConflictoSiCambio(error);
        }
    }
}