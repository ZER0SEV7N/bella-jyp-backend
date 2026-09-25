//src/modules/asistencia/use-cases/generarIncidenciasMes.useCase.ts
import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import type { GenerarIncidenciasPeriodoDto } from "@jyp/shared-contracts";
import { obtenerPeriodo, obtenerColaboradores, procesarColaborador } from "./helper/procesamiento.helper";

/**
 * Caso de uso para generar incidencias de asistencia para un período específico.
 * Este caso de uso procesa los registros de asistencia de los empleados activos,
 * evaluando faltas y tardanzas según su horario laboral y solicitudes aprobadas.
 * Los resultados se almacenan en la base de datos y se devuelven al final del proceso.
 */
@Injectable()
export class GenerarIncidenciasMesUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Metodo de ejecución principal del caso de uso. 
     * Procesa los empleados activos y genera las incidencias de asistencia para el período especificado.
     * @param dto - Dto que contiene el período y los filtros opcionales para empleados y áreas.
     * @returns Un objeto con el resumen del procesamiento, incluyendo el número de empleados procesados y los detalles de cada uno.
     * @throws BadRequestException - Si el DTO es inválido.
     * @throws NotFoundException - Si no se encuentran empleados activos para procesar.
     * @throws InternalServerErrorException - Si ocurre un error inesperado durante el procesamiento.
     */
    async execute(dto: GenerarIncidenciasPeriodoDto) {
        try {
            //Validación básica del DTO
            const periodo = obtenerPeriodo(dto.periodo);
            const colaboradores = await obtenerColaboradores(this.prisma, dto, periodo);

            if (!colaboradores.length) throw new NotFoundException({
                title: 'Sin empleados para procesar',
                detail: 'No se encontraron empleados activos con los criterios especificados.',
            });
            
            //Procesamiento de cada colaborador y generación de incidencias
            const resultadosProcesados = [];
            for (const emp of colaboradores) 
                resultadosProcesados.push(await procesarColaborador(this.prisma, emp, dto.periodo, periodo));
            
            return {
                mensaje: `Se procesaron exitosamente las incidencias para ${resultadosProcesados.length} colaborador(es) en el periodo ${dto.periodo}.`,
                periodo: dto.periodo,
                total_procesados: resultadosProcesados.length,
                detalle: resultadosProcesados,
            };
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException) 
                throw error;
            
            throw new InternalServerErrorException({
                title: 'Error en Consolidación de Asistencia',
                detail: error instanceof Error ? error.message : 'Fallo inesperado al generar las incidencias del mes.',
            });
        }
    }

}