//src/modules/RRHH/solicitudes/use-cases/asignarRevisionDeSolicitud.useCase.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

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
        const solicitud = await this.prisma.solicitud.findUnique({
            where: { id: solicitudId, deleted_at: null },
            include: { responsable: { select: { id: true, empleados: { select: { nombre: true, apellido: true } } } } }
        });

        if(!solicitud) throw new NotFoundException('La solicitud especificada no existe o ha sido eliminada.');

        if(solicitud.estado === 'APROBADA' || solicitud.estado === 'RECHAZADA' || solicitud.estado === 'ANULADA') 
            throw new BadRequestException(`La solicitud ya se encuentra dictaminada con estado '${solicitud.estado}'.`);
        
        if (solicitud.responsable_id && solicitud.responsable_id !== usuarioId) {
            const nombreResponsable = solicitud.responsable?.empleados
                ? `${solicitud.responsable.empleados.nombre} ${solicitud.responsable.empleados.apellido}`
                : 'otro revisor';

            throw new BadRequestException(`La solicitud ya se encuentra tomada en revision por ${nombreResponsable}.`)
        }
        
        //Si la solicitud ya tiene un responsable asignado 
        //y es el mismo que el usuario actual, no se realiza ninguna acción adicional
        return await this.prisma.solicitud.update({
            where: { id: solicitudId },
            data: { responsable_id: usuarioId, estado: 'EN_REVISION'},
            include: {
                responsable: {
                    select: {
                        id: true,
                        email: true,
                        empleados: { select: { nombre: true, apellido: true } }
                    }
                }
            }
        });
    }
}