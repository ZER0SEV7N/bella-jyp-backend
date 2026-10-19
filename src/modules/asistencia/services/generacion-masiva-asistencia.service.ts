import { ServerTime } from '@/common/utils/server-time';
import { GenerarIncidenciaEmpleadoUseCase } from '../use-cases/Incidencias/generarIncidenciaEmpleado.useCase';
import type { ActorOperacion } from './asistencia-transaccion.helper';
//src/modules/asistencia/use-cases/generarIncidenciasMes.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import type { GenerarIncidenciasPeriodoDto } from '@jyp/shared-contracts';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

/**
 * Caso de uso para generar incidencias de asistencia para un período específico.
 * Este caso de uso procesa los registros de asistencia de los empleados activos,
 * evaluando faltas y tardanzas según su horario laboral y solicitudes aprobadas.
 * Los resultados se almacenan en la base de datos y se devuelven al final del proceso.
 */
@Injectable()
export class GeneracionMasivaAsistenciaService {
    constructor(private readonly prisma: PrismaService, private readonly asistencia: GenerarIncidenciaEmpleadoUseCase) {}

    /**
     * Metodo de ejecución principal del caso de uso.
     * Procesa los empleados activos y genera las incidencias de asistencia para el período especificado.
     * @param dto - Dto que contiene el período y los filtros opcionales para empleados y áreas.
     * @returns Un objeto con el resumen del procesamiento, incluyendo el número de empleados procesados y los detalles de cada uno.
     * @throws BadRequestException - Si el DTO es inválido.
     * @throws NotFoundException - Si no se encuentran empleados activos para procesar.
     * @throws InternalServerErrorException - Si ocurre un error inesperado durante el procesamiento.
     */
    async generar(dto: GenerarIncidenciasPeriodoDto, actor: ActorOperacion) {
        const { year, month } = ServerTime.validarPeriodo(dto.periodo);
        if (dto.periodo > ServerTime.obtenerPeriodoActual) throw new BadRequestException('No se puede generar un período futuro.');
        const fin = new Date(Date.UTC(year, month, 0));
        const inicio = ServerTime.desdeFechaSimple(`${dto.periodo}-01`);
        //La fecha del vínculo determina la selección, no el indicador activo actual.
        const empleados = await this.prisma.empleados.findMany({
            where: {
                deleted_at: null,
                ...(dto.empleado_id ? { id: dto.empleado_id } : {}),
                ...(dto.area_id ? { area_id: dto.area_id } : {}),
                AND: [{ OR: [{ fecha_inicio: null }, { fecha_inicio: { lte: fin } }] }, { OR: [{ fecha_cese: null }, { fecha_cese: { gte: inicio } }] }]
            },
            select: { id: true },
            orderBy: { id: 'asc' },
            take: dto.limite + 1,
            ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {})
        });
        if (!empleados.length) throw new NotFoundException('No se encontraron colaboradores para el período solicitado.');
        const lote = empleados.slice(0, dto.limite);
        const resultados: { empleado_id: string; id?: string; estado?: string; error?: string }[] = [];
        for (const empleado of lote) {
            try {
                const resumen = await this.asistencia.execute(empleado.id, dto.periodo, actor);
                resultados.push({ empleado_id: empleado.id, id: resumen.id, estado: resumen.estado });
            } catch (error) {
                if (dto.empleado_id) throw error;
                resultados.push({ empleado_id: empleado.id, error: mensajeErrorIncidencia(error) });
            }
        }
        return {
            periodo: dto.periodo,
            total_procesados: resultados.filter((r) => !r.error).length,
            errores: resultados.filter((r) => r.error).length,
            siguiente_cursor: empleados.length > dto.limite ? lote.at(-1)!.id : null,
            detalle: resultados
        };
    }
}

/** Conserva una explicación útil sin asumir que se lanzó una instancia de Error. */
function mensajeErrorIncidencia(error: unknown): string {
    return error instanceof Error ? error.message : 'No fue posible calcular la incidencia.';
}
