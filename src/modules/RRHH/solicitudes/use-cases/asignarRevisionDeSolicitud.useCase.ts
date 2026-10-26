//src/modules/RRHH/solicitudes/use-cases/asignarRevisionDeSolicitud.useCase.ts
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { SOLICITUD_INCLUDE, obtenerSolicitudOperativa, verificarRevisorActivo } from '../helpers/validacionesSolicitud.helper';
import { Prisma } from '@prisma/client';
import { transaccionAuditada  } from '@/common/utils/transaccion-auditada.util';

/**
 * Caso de uso para asignar la revisión de una solicitud de RRHH a un responsable.
 * Este caso de uso tiene como objetivo actualizar la solicitud con el ID del responsable asignado para su revisión.
 */
@Injectable()
export class AsignarRevisionDeSolicitudUseCase {
  constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para asignar la revisión de una solicitud de RRHH a un responsable.
     * @param solicitudId - El ID de la solicitud a la que se le asignará un responsable.
     * @param usuarioId - El ID del usuario que será asignado como responsable de la revisión.
     */
    async execute(solicitudId: string, usuarioId: string, ip = '127.0.0.1') {
        //Verificar que el revisor esté activo y tenga permisos para revisar solicitudes
        await verificarRevisorActivo(this.prisma, usuarioId);

        //Validar que la solicitud exista y esté en un estado que permita la asignación de revisión
        const solicitud = await obtenerSolicitudOperativa(this.prisma, solicitudId);
        if (solicitud.estado !== 'PENDIENTE' && solicitud.estado !== 'EN_REVISION') throw new ConflictException({
            title: 'Solicitud finalizada',
            detail: `La solicitud ${solicitud.codigo} se encuentra en estado ${solicitud.estado}.`,
        });

        //Verificar si la solicitud ya tiene un responsable asignado y si es diferente al usuario que intenta tomarla
        if (solicitud.responsable_id && solicitud.responsable_id !== usuarioId)
            throw new ConflictException('La solicitud ya se encuentra tomada por otro revisor.');

        //Repetir la toma por el mismo revisor no genera otra actualización ni otro evento de auditoría.
        if (solicitud.estado === 'EN_REVISION' && solicitud.responsable_id === usuarioId)
            return this.prisma.solicitud.findUniqueOrThrow({
                where: { id: solicitudId, estado: 'EN_REVISION', responsable_id: usuarioId, deleted_at: null },
                include: SOLICITUD_INCLUDE,
            }).catch(() => { throw new ConflictException('La solicitud ya se encuentra tomada por otro revisor.'); });

        //Realizar la transacción para actualizar el responsable de la solicitud y cambiar su estado a 'EN_REVISION'
        try {
            return await transaccionAuditada(this.prisma, { id: usuarioId, ip }, (tx) =>
                tx.solicitud.update({
                    where: { id: solicitud.id, estado: solicitud.estado, responsable_id: solicitud.responsable_id, deleted_at: null },
                    data: { responsable_id: usuarioId, estado: 'EN_REVISION' },
                    include: SOLICITUD_INCLUDE,
            }));
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new ConflictException({
                title: 'Solicitud modificada',
                detail: 'Otro usuario modificó la solicitud. Actualice el detalle antes de continuar.'
            });

            throw error;
        }
    }
}
