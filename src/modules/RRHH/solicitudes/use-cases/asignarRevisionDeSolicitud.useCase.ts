//src/modules/RRHH/solicitudes/use-cases/asignarRevisionDeSolicitud.useCase.ts
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { SOLICITUD_INCLUDE, construirCondicionActual, lanzarConflictoSiCambio, obtenerSolicitudOperativa, validarSolicitudAbierta, verificarRevisorActivo } from '../helpers/validacionesSolicitud.helper';

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
    async execute(solicitudId: string, usuarioId: string){
        await verificarRevisorActivo(this.prisma, usuarioId);
        const solicitud = await obtenerSolicitudOperativa(this.prisma, solicitudId);
        validarSolicitudAbierta(solicitud);

        if (solicitud.responsable_id && solicitud.responsable_id !== usuarioId)
            throw new ConflictException('La solicitud ya se encuentra tomada por otro revisor.');

        // Repetir la toma por el mismo revisor no genera otra actualización ni otro evento de auditoría.
        if (solicitud.estado === 'EN_REVISION' && solicitud.responsable_id === usuarioId)
            return this.prisma.solicitud.findUniqueOrThrow({ where: { id: solicitudId, estado: 'EN_REVISION', responsable_id: usuarioId, deleted_at: null }, include: SOLICITUD_INCLUDE }).catch(lanzarConflictoSiCambio);

        try {
            return await this.prisma.solicitud.update({
                where: construirCondicionActual(solicitud),
                data: { responsable_id: usuarioId, estado: 'EN_REVISION' },
                include: SOLICITUD_INCLUDE
            });
        } catch (error) {
            return lanzarConflictoSiCambio(error);
        }
    }
}