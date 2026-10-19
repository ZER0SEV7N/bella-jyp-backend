import { AprobacionMasivaAsistenciaService } from '../../services/aprobacion-masiva-asistencia.service';
import type { ActorOperacion } from '../../services/asistencia-transaccion.helper';
//src/modules/asistencia/use-cases/Incidencias/aprobarIncidenciaMes.useCase.ts
import type { AprobarIncidenciasDto } from '@jyp/shared-contracts';
import { Injectable } from '@nestjs/common';

/**
 * Caso de uso para aprobar incidencias de asistencia para un período específico.
 * Este caso de uso actualiza el estado de las incidencias pendientes a "APROBADO" en la base de datos.
 * Se puede filtrar por período y opcionalmente por empleado.
 * Devuelve un resumen del número de incidencias aprobadas.
 */
@Injectable()
export class AprobarIncidenciaMesUseCase {
    constructor(private readonly asistencia: AprobacionMasivaAsistenciaService) {}

    /**
     * Ejecuta el caso de uso para aprobar incidencias de asistencia.
     * @param dto - Dto que contiene el período y opcionalmente el ID del empleado para filtrar las incidencias a aprobar.
     * @returns - Un objeto con el resumen de la operación, incluyendo el número de incidencias aprobadas y un mensaje de éxito.
     * @throws BadRequestException - Si el DTO es inválido.
     * @throws NotFoundException - Si no se encuentran incidencias pendientes para aprobar.
     * @throws InternalServerErrorException - Si ocurre un error inesperado durante la actualización de las incidencias.
     */
    async execute(dto: AprobarIncidenciasDto, actor: ActorOperacion) {
        return this.asistencia.aprobarLote(dto.periodo, dto.empleado_id, actor);
    }
}
