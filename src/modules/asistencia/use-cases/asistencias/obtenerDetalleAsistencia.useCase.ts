//src/modules/asistencia/use-cases/asistencias/obtenerDetalleAsistencia.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';

/**
 * Caso de uso para obtener el detalle de asistencia de un empleado en un período específico.
 * Este caso de uso consulta la base de datos para obtener el resumen de incidencias de asistencia del empleado.
 * Si no se encuentra un resumen para el período especificado, se lanza una excepción NotFoundException.
 * @requires - PrismaService para acceder a la base de datos y consultar el resumen de incidencias.
 */
@Injectable()
export class ObtenerDetalleAsistenciaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para obtener el detalle de asistencia de un empleado en un período específico.
     * @param empleadoId - Identificador del empleado para el cual se desea obtener el detalle de asistencia.
     * @param periodo - Período en formato 'YYYY-MM' para el cual se desea obtener el detalle de asistencia.
     * @returns - Promesa que se resuelve con el resumen de incidencias de asistencia del empleado si se encuentra.
     * @throws NotFoundException si no se encuentra un resumen de incidencias para el período especificado.
     */
    async execute(empleadoId: string, periodo: string) {
        //Se busca el resumen de incidencias de asistencia del empleado para el período especificado en la base de datos.
        const resumen = await this.prisma.incidencias_mes.findUnique({ where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } } });
        if (!resumen) 
            throw new NotFoundException('Primero debe generar las incidencias del período.');
        
        //Se devuelve el resumen de incidencias de asistencia del empleado si se encuentra.
        return resumen;
    }
}
