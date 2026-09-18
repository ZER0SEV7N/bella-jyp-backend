//src/modules/RRHH/organizacion/use-cases/derechohabiente/listarDerechohabientes.useCase.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Caso de uso para listar los derechohabientes asociados a un empleado titular.
 * Este caso de uso permite obtener todos los derechohabientes activos y sus sustentos documentales,
 * filtrando por el ID del empleado titular y excluyendo aquellos que han sido eliminados.
 */
@Injectable()
export class ListarDerechohabientesUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Metodo principal para ejecutar el caso de uso de listado de derechohabientes.
     * @param empleadoId - ID del empleado titular cuyos derechohabientes se desean listar.
     * @returns - Una lista de derechohabientes asociados al empleado titular, incluyendo información de tipo de documento y sustentos documentales.
     * @throws InternalServerErrorException si ocurre un error al consultar la base de datos.
     */
    async listarPorEmpleado(empleadoId: string) {
        try{
            return await this.prisma.derechohabientes.findMany({
                where: { empleado_id: empleadoId, deleted_at: null },
                include: {
                    tipo_documento: { select: { id: true, tipo_documento: true } },
                    documentos: {
                        where: { deleted_at: null },
                        select: {
                            id: true,
                            tipo_documento: true,
                            archivo_url: true,
                            fecha_emision: true,
                            fecha_vencimiento: true,
                            created_at: true
                        }
                    }
                },
                orderBy: { created_at: 'desc' }
            });
        } catch (error) {
            throw new InternalServerErrorException({
                title: 'Error al Listar Derechohabientes',
                detail: error instanceof Error ? error.message : 'Fallo interno al consultar derechohabientes.'
            });
        }
    }
}