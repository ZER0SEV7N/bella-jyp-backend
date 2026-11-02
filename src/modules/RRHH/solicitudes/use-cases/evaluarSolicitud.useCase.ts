//src/modules/rrhh/solicitudes/use-cases/evaluarSolicitud.useCase.ts
import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { EvaluarSolicitudDto } from '@jyp/shared-contracts';
import {SOLICITUD_INCLUDE, obtenerSolicitudOperativa, validarResponsable, verificarRevisorActivo } from '../helpers/validacionesSolicitud.helper';
import { Prisma } from '@prisma/client';
import { transaccionAuditada, bloquearEmpleado } from '@/common/utils/transaccion-auditada.util';
import { validarPeriodoEditable } from '@/modules/asistencia/helpers/periodo-editable.helper';

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
    async execute(solicitudId: string, dto: EvaluarSolicitudDto, usuarioEvaluadorId: string, ip = '127.0.0.1') {
        //Validar que el estado proporcionado sea APROBADA o RECHAZADA
        if (dto.estado !== 'APROBADA' && dto.estado !== 'RECHAZADA')
            throw new BadRequestException('El dictamen debe ser APROBADA o RECHAZADA.');

        //Si el estado es RECHAZADA, se valida que se proporcione un motivo de rechazo; de lo contrario, se permite un comentario opcional.
        const observacion = dto.observacion?.trim() ?? '';
        if (dto.estado === 'RECHAZADA' && (observacion.length < 5 || observacion.length > 2000))
            throw new BadRequestException('Ingrese un motivo de rechazo de 5 a 2000 caracteres.');
        
        //Verificar que el usuario evaluador esté activo y tenga permisos para evaluar solicitudes
        await verificarRevisorActivo(this.prisma, usuarioEvaluadorId);

        //Validar que la solicitud exista y esté en un estado que permita la evaluación
        const solicitud = await obtenerSolicitudOperativa(this.prisma, solicitudId);
        if (solicitud.estado !== 'PENDIENTE' && solicitud.estado !== 'EN_REVISION')throw new ConflictException({
            title: 'Solicitud finalizada',
            detail: `La solicitud ${solicitud.codigo} se encuentra en estado ${solicitud.estado}.`,
        });
      
        //Validar que el usuario evaluador sea el responsable de la solicitud.
        validarResponsable(solicitud, usuarioEvaluadorId);

        //Se intenta actualizar la solicitud con el nuevo estado y observación, manejando posibles conflictos de concurrencia.
        try {
            return await transaccionAuditada(this.prisma, { id: usuarioEvaluadorId, ip }, async (tx) => {
                //Bloquear al empleado asociado a la solicitud para evitar modificaciones concurrentes durante la evaluación.
                await bloquearEmpleado(tx, solicitud.empleado_id);
                //Una aprobación que afecte asistencia no puede modificar un periodo congelado.
                if (dto.estado === 'APROBADA' && solicitud.fecha_inicio && solicitud.fecha_fin) {
                    //Validar que todos los periodos de la solicitud sean editables antes de aprobarla.
                    const mes = new Date(solicitud.fecha_inicio);
                    mes.setUTCDate(1);

                    //Iterar por cada mes entre la fecha de inicio y fin de la solicitud para validar que el periodo sea editable.
                    for (; mes <= solicitud.fecha_fin; mes.setUTCMonth(mes.getUTCMonth() + 1))
                        await validarPeriodoEditable(tx, solicitud.empleado_id, mes.toISOString().slice(0, 7));
                }

                //Actualizar la solicitud con el nuevo estado y observación, incluyendo los datos relacionados según SOLICITUD_INCLUDE.
                return tx.solicitud.update({
                    where: { id: solicitud.id, estado: solicitud.estado, responsable_id: solicitud.responsable_id, deleted_at: null },
                    data: { estado: dto.estado, efecto_asistencia: dto.efecto_asistencia, observacion: observacion || solicitud.observacion },
                    include: SOLICITUD_INCLUDE,
                });
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new ConflictException({
                title: 'Solicitud modificada',
                detail: 'Otro usuario modificó la solicitud. Actualice el detalle antes de continuar.',
                });

            throw error;
        }
    }
}
