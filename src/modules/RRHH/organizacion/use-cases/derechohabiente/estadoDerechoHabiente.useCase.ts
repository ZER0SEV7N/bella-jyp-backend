//src/modules/RRHH/organizacion/use-cases/derechohabiente/estadoDerechoHabiente.useCase.ts
import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Caso de uso para cambiar el estado de un derechohabiente, permitiendo su desactivación.
 * Este caso de uso valida la existencia del derechohabiente y su estado actual antes de proceder a la desactivación.
 * La desactivación implica marcar el derechohabiente como inactivo y registrar la fecha de eliminación.
 */
@Injectable()
export class EstadoDerechohabienteUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /** 
     * Metodo principal para ejecutar el caso de uso de desactivación de un derechohabiente.
     * @param id - ID del derechohabiente a desactivar.
     * @returns - El derechohabiente desactivado con su estado actualizado.
     * @throws NotFoundException si el derechohabiente no existe o ya está inactivo.
     * @throws InternalServerErrorException si ocurre un error al actualizar la base de datos.
     */
    async desactivar(id: string) {
        try {
            const familiar = await this.prisma.derechohabientes.findUnique({ where: { id, deleted_at: null } });

            if (!familiar || !familiar.activo) throw new NotFoundException({
                title: 'Derechohabiente no encontrado',
                detail: 'El derechohabiente no existe o ya ha sido dado de baja.'
            });
      
            return await this.prisma.derechohabientes.update({
                where: { id },
                data: { activo: false, deleted_at: new Date() }
            });
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;

            throw new InternalServerErrorException({
                title: 'Error al Desactivar Derechohabiente',
                detail: error instanceof Error ? error.message : 'Fallo interno al procesar la baja.'
            });
        }
    }

    /**
     * Metodo para reactivar un derechohabiente previamente desactivado.
     * @param id - ID del derechohabiente a reactivar.
     * @returns - El derechohabiente reactivado con su estado actualizado.
     * @throws NotFoundException si el derechohabiente no existe.
     * @throws BadRequestException si el derechohabiente ya está activo.
     * @throws InternalServerErrorException si ocurre un error al actualizar la base de datos.
     */
    async reactivar(id: string) {
        try {
            const familiar = await this.prisma.derechohabientes.findUnique({ where: { id } });

            if (!familiar) throw new NotFoundException({
                title: 'Derechohabiente no encontrado',
                detail: 'El registro especificado no existe.'
            });
            

            if (familiar.activo && familiar.deleted_at === null) throw new BadRequestException({
                title: 'Derechohabiente ya activo',
                detail: 'El familiar ya se encuentra activo en el sistema.'
            });
        
            return await this.prisma.derechohabientes.update({
                where: { id },
                data: { activo: true, deleted_at: null }
            });
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
            
            throw new InternalServerErrorException({
                title: 'Error al Reactivar Derechohabiente',
                detail: error instanceof Error ? error.message : 'Fallo interno al reactivar el familiar.'
            });
        }
    }
}