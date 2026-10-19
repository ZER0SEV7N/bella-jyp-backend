import type { ActorOperacion } from '../../services/asistencia-transaccion.helper';
import { GeneracionMasivaAsistenciaService } from '../../services/generacion-masiva-asistencia.service';
//src/modules/asistencia/use-cases/generarIncidenciasMes.useCase.ts
import type { GenerarIncidenciasPeriodoDto } from '@jyp/shared-contracts';
import { Injectable } from '@nestjs/common';

/**
 * Caso de uso para generar incidencias de asistencia para un período específico.
 * Este caso de uso procesa los registros de asistencia de los empleados activos,
 * evaluando faltas y tardanzas según su horario laboral y solicitudes aprobadas.
 * Los resultados se almacenan en la base de datos y se devuelven al final del proceso.
 */
@Injectable()
export class GenerarIncidenciasMesUseCase {
    constructor(private readonly generacionMasiva: GeneracionMasivaAsistenciaService) {}

    /**
     * Metodo de ejecución principal del caso de uso.
     * Procesa los empleados activos y genera las incidencias de asistencia para el período especificado.
     * @param dto - Dto que contiene el período y los filtros opcionales para empleados y áreas.
     * @returns Un objeto con el resumen del procesamiento, incluyendo el número de empleados procesados y los detalles de cada uno.
     * @throws BadRequestException - Si el DTO es inválido.
     * @throws NotFoundException - Si no se encuentran empleados activos para procesar.
     * @throws InternalServerErrorException - Si ocurre un error inesperado durante el procesamiento.
     */
    async execute(dto: GenerarIncidenciasPeriodoDto, actor: ActorOperacion) {
        return this.generacionMasiva.generar(dto, actor);
    }
}
