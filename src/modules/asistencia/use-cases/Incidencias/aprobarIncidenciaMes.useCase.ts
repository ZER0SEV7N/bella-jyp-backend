//src/modules/asistencia/use-cases/Incidencias/aprobarIncidenciaMes.useCase.ts
import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import type { AprobarIncidenciasDto } from "@jyp/shared-contracts";

/**
 * Caso de uso para aprobar incidencias de asistencia para un período específico.
 * Este caso de uso actualiza el estado de las incidencias pendientes a "APROBADO" en la base de datos.
 * Se puede filtrar por período y opcionalmente por empleado.
 * Devuelve un resumen del número de incidencias aprobadas.
 */
@Injectable()
export class AprobarIncidenciaMesUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para aprobar incidencias de asistencia.
     * @param dto - Dto que contiene el período y opcionalmente el ID del empleado para filtrar las incidencias a aprobar.
     * @returns - Un objeto con el resumen de la operación, incluyendo el número de incidencias aprobadas y un mensaje de éxito.
     * @throws BadRequestException - Si el DTO es inválido.
     * @throws NotFoundException - Si no se encuentran incidencias pendientes para aprobar.
     * @throws InternalServerErrorException - Si ocurre un error inesperado durante la actualización de las incidencias.
     */
    async execute(dto: AprobarIncidenciasDto) {
        const { periodo, empleado_id } = dto;

        //Validacion de la existencia de incidencias pendientes para el período y empleado especificados
        const whereClause: any = { periodo: periodo.trim(), estado: 'PENDIENTE'};

        if(empleado_id) whereClause.empleado_id = empleado_id;

        //Contar incidencias pendientes
        const pendientes = await this.prisma.incidencias_mes.count({ where: whereClause });

        if(pendientes === 0) throw new NotFoundException({
            title: 'Sin incidencias pendientes',
            detail: `No se encontraron incidencias en estado PENDIENTE para el período ${periodo}.`,
        });

        //Actualizar incidencias a estado APROBADO
        try{
            const result = await this.prisma.incidencias_mes.updateMany({
                where: whereClause,
                data: { estado: 'APROBADO' },
            });

            return {
                success: true,
                periodo,
                registros_aprobados: result.count,
                message: `Se aprobaron ${result.count} incidencia(s) para el período ${periodo}.`,
            };
        }
        catch (error) {
            throw new InternalServerErrorException(
                'Error al procesar la aprobación de incidencias mensuales.',
                error instanceof Error ? error.message : String(error)
            );
        }
    }
}