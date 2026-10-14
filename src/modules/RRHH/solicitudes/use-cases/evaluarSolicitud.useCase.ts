//src/modules/rrhh/solicitudes/use-cases/evaluarSolicitud.useCase.ts
import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { EvaluarSolicitudDto } from '@jyp/shared-contracts';
import { SOLICITUD_INCLUDE, construirCondicionActual, lanzarConflictoSiCambio, obtenerSolicitudOperativa, validarMotivo, validarResponsable, validarSolicitudAbierta, verificarRevisorActivo } from '../helpers/validacionesSolicitud.helper';

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
     * @param solicitudId - El ID de la solicitud que se va a evaluar.
     * @param dto - Objeto que contiene el estado de la solicitud y un comentario opcional.
     * @param usuarioEvaluadorId - El ID del usuario que está evaluando la solicitud.
     * @returns - La solicitud actualizada después de la evaluación.
     * @throws BadRequestException - Si el estado proporcionado no es válido.
     * @throws NotFoundException - Si la solicitud no existe o no está operativa.
     * @throws ForbiddenException - Si el usuario evaluador no tiene permisos para evaluar la solicitud.
     * @throws ConflictException - Si la solicitud ha sido modificada por otro usuario durante la evaluación.
     */
    async execute(solicitudId: string, dto: EvaluarSolicitudDto, usuarioEvaluadorId: string) {
        if (dto.estado !== 'APROBADA' && dto.estado !== 'RECHAZADA')
            throw new BadRequestException('El dictamen debe ser APROBADA o RECHAZADA.');

        //Si el estado es RECHAZADA, se valida que se proporcione un motivo de rechazo; de lo contrario, se permite un comentario opcional.
        const observacion = dto.estado === 'RECHAZADA' ? validarMotivo(dto.observacion, 'Motivo de rechazo requerido') : dto.observacion?.trim();
        await verificarRevisorActivo(this.prisma, usuarioEvaluadorId);
        const solicitud = await obtenerSolicitudOperativa(this.prisma, solicitudId);
        validarSolicitudAbierta(solicitud);
        validarResponsable(solicitud, usuarioEvaluadorId);

        //Se intenta actualizar la solicitud con el nuevo estado y observación, manejando posibles conflictos de concurrencia.
        try {
            return await this.prisma.solicitud.update({
                where: construirCondicionActual(solicitud),
                data: { estado: dto.estado, observacion: observacion || solicitud.observacion },
                include: SOLICITUD_INCLUDE
            });
        } catch (error) {
            return lanzarConflictoSiCambio(error);
        }
    }
}