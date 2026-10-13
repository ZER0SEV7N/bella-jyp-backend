//src/modules/rrhh/solicitudes/use-cases/evaluarSolicitud.useCase.ts
import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
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
        
        //Validar que la solicitud exista y no haya sido eliminada
        const solicitud = await this.prisma.solicitud.findUnique({
            where: { id: solicitudId, deleted_at: null },
            select: {
                id: true,
                codigo: true,
                estado: true,
                observacion: true,
                responsable_id: true
            }
        });
        
        if(!solicitud) throw new NotFoundException('La solicitud especificada no existe o ha sido eliminada.');

        if(solicitud.estado === 'APROBADA' || solicitud.estado === 'RECHAZADA' || solicitud.estado === 'ANULADA') throw new ConflictException({
            title: 'Solicitud finalizada',
            detail: `La solicitud ${solicitud.codigo} ya se encuentra en estado ${solicitud.estado}.`
        });

        /*
         * No permitimos saltarnos el workflow.
         *
         * Primero tiene que haber sido tomada para revisión.
         */
        if (solicitud.estado !== 'EN_REVISION') throw new ConflictException({
            title: 'Solicitud no iniciada en revisión',
            detail: 'La solicitud debe encontrarse en estado EN_REVISION antes de poder ser evaluada.'
        });
        

        //Validar que la solicitud tenga un responsable asignado
        if (!solicitud.responsable_id) throw new ConflictException({
            title: 'Solicitud sin responsable',
            detail: 'La solicitud no tiene un responsable asignado para realizar la evaluación.'
        });
        

        // Validar que el usuario evaluador sea el responsable asignado a la solicitud
        if ( solicitud.responsable_id !== usuarioEvaluadorId ) throw new ForbiddenException({
            title: 'Solicitud asignada a otro revisor',
            detail: 'Solo el responsable actualmente asignado puede aprobar o rechazar esta solicitud.'
        });
    

        //Validación de reglas de negocio según el estado de la solicitud
        if (dto.estado === 'RECHAZADA' && ( !dto.observacion || dto.observacion.trim().length < 5 )) throw new BadRequestException({
            title: 'Motivo de rechazo requerido',
            detail: 'Debe ingresar una observación descriptiva de al menos 5 caracteres.'
        });
        

        //Actualizar la solicitud con el nuevo estado y la observación proporcionada
        return await this.prisma.solicitud.update({
            where: { id: solicitudId},
            data: {
                estado: dto.estado,
                observacion:
                    dto.observacion?.trim() ??
                    solicitud.observacion
            },
            include: {
                empleados: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        nro_documento: true
                    }
                },

                responsable: {
                    select: {
                        id: true,
                        email: true,
                        empleados: {
                            select: {
                                nombre: true,
                                apellido: true
                            }
                        }
                    }
                }
            }
        });
    }
}