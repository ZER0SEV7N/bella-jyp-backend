//src/modules/RRHH/solicitudes/use-cases/anularSolicitud.useCase.ts
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { SOLICITUD_INCLUDE, obtenerSolicitudOperativa } from '../helpers/validacionesSolicitud.helper';
import { Prisma } from '@prisma/client';
import { transaccionAuditada } from '@/common/utils/transaccion-auditada.util';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';

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
    async execute(solicitudId: string, motivoAnulacion: string, actor: ActorOperacion) {
        //Validar que el periodo de la solicitud sea editable
        const motivo = motivoAnulacion?.trim();
        if (!motivo || motivo.length < 5 || motivo.length > 3000)
            throw new BadRequestException('Ingrese un motivo de anulación de 5 a 3000 caracteres.');

        //Validar que la solicitud exista y esté en un estado que permita la anulación
        const solicitud = await obtenerSolicitudOperativa(this.prisma, solicitudId);

        //Validar que la solicitud esté en un estado que permita la anulación
        if (solicitud.estado !== 'PENDIENTE' && solicitud.estado !== 'EN_REVISION') throw new ConflictException({
            title: 'Solicitud finalizada',
            detail: `La solicitud ${solicitud.codigo} se encuentra en estado ${solicitud.estado}.`,
        });

        //Validar que la solicitud no haya sido aprobada previamente
        try {
            //Realizar la transacción para actualizar el estado de la solicitud a 'ANULADA' y registrar la observación
            return await transaccionAuditada(this.prisma, actor, (tx) =>
                tx.solicitud.update({
                    where: { id: solicitud.id, estado: solicitud.estado, responsable_id: solicitud.responsable_id, deleted_at: null },
                    //ANULADA es un estado de negocio; el registro continúa visible en detalle e historial.
                    data: { estado: 'ANULADA', observacion: motivo },
                    include: SOLICITUD_INCLUDE,
                }));
        //Capturar errores de concurrencia y lanzar una excepción de conflicto si otro usuario modificó la solicitud
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')
                throw new ConflictException({
                    title: 'Solicitud modificada',
                    detail: 'Otro usuario modificó la solicitud. Actualice el detalle antes de continuar.',
                });

            throw error;
        }
    }
}
