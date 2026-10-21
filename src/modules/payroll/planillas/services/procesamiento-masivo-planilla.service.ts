//src/modules/payroll/planillas/services/procesamiento-masivo-planilla.service.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import type { JobPayrollData } from '@/workers/calculo-masivo/payroll.processor';
import { HttpException, Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { GenerarPlanillaUseCase } from '../use-case/planillas/generarPlanilla.useCase';

/**
 * Servicio para el procesamiento masivo de planillas.
 * Este servicio permite generar planillas de manera masiva para un conjunto de empleados, aplicando filtros por período, empleado y área.
 * Se encarga de iterar sobre los empleados que cumplen con los criterios especificados, generando la planilla para cada uno y registrando los resultados.
 * @requires - PrismaService para acceder a la base de datos y consultar los empleados y planillas.
 * @requires - GenerarPlanillaUseCase para generar la planilla de cada empleado individualmente.
 */

type ErrorEmpleado = { empleado_id: string; detalle: string }; //

@Injectable()
export class ProcesamientoMasivoPlanillasService {
    constructor(private readonly prisma: PrismaService, 
        private readonly generarPlanilla: GenerarPlanillaUseCase) {}

    /**
     * Procesa la generación de planillas de manera masiva para los empleados que cumplen con los filtros especificados en el trabajo.
     * @param job - El trabajo que contiene los datos necesarios para el procesamiento masivo, incluyendo el período, empleado y área.
     * @returns Un objeto con el estado del procesamiento, el total de empleados procesados, la cantidad de planillas generadas correctamente, la cantidad de fallidas y un listado de errores por empleado.
     * @throws Error si no existen colaboradores dentro del período y los filtros solicitados.
     */
    async procesar(job: Job<JobPayrollData>) {
        //Valida los filtros y obtiene el total de empleados que cumplen con los criterios especificados en el trabajo.
        const where = this.filtros(job.data);

        //Cuenta el total de empleados que cumplen con los filtros especificados.
        const total = await this.prisma.empleados.count({ where });
        if (!total) 
            throw new Error('No existen colaboradores dentro del período y los filtros solicitados.');

        //Inicializa las variables para el procesamiento de los empleados, incluyendo el cursor para la paginación, y los contadores de procesados, correctos y fallidos.
        let cursor: string | undefined,
            procesados = 0,
            correctos = 0,
            fallidos = 0;
        
        //Lista para almacenar los errores encontrados durante el procesamiento de los empleados.
        const errores: ErrorEmpleado[] = [];

        //Itera sobre los empleados que cumplen con los filtros especificados, procesando cada uno de ellos y registrando los resultados.
        while (true) {
            const empleados = await this.prisma.empleados.findMany({
                where,
                select: { id: true },
                orderBy: { id: 'asc' },
                take: 50,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
            });

            //Si no hay más empleados que procesar, se rompe el bucle.
            if (!empleados.length) break;

            //Procesa cada empleado, registrando los errores encontrados y actualizando el progreso del trabajo.
            for (const empleado of empleados) {
                const error = await this.procesarEmpleado(job, empleado.id);

                //Si se encuentra un error, se incrementa el contador de fallidos y se registra el error; de lo contrario, se incrementa el contador de correctos.
                if (error) {
                    fallidos++;
                    registrarError(errores, error);
                } else 
                    correctos++;
                procesados++;
                await job.updateProgress({ total, procesados, correctos, fallidos });
            }
            //Actualiza el cursor para la siguiente iteración, apuntando al último empleado procesado.
            cursor = empleados.at(-1)!.id;
        }
        //Devuelve el estado del procesamiento, incluyendo el total de empleados procesados, 
        //la cantidad de planillas generadas correctamente, la cantidad de fallidas y un listado de errores por empleado.
        return { estado: estadoResultado(correctos, fallidos), total: procesados, correctos, fallidos, errores, errores_truncados: fallidos > errores.length };
    }

    /**
     * Genera los filtros para la consulta de empleados según los criterios especificados en el trabajo.
     * @param dto - El objeto que contiene los datos necesarios para generar los filtros, incluyendo el período, empleado y área.
     * @returns - Un objeto con los filtros generados para la consulta de empleados.
     * @throws Error si el período especificado no es válido.
     */
    private filtros({ dto }: JobPayrollData) {
        //Valida el período especificado en el DTO y obtiene la fecha de inicio y fin del período.
        const { year, month } = ServerTime.validarPeriodo(dto.periodo);

        //Calcula la fecha de inicio y fin del período, considerando el primer día del mes y el último día del mes.
        const inicio = ServerTime.desdeFechaSimple(`${dto.periodo}-01`), fin = new Date(Date.UTC(year, month, 0));
        
        //Devuelve un objeto con los filtros generados para la consulta de empleados, 
        //incluyendo la fecha de inicio y fin del período, el estado de cese del empleado y los filtros opcionales por empleado y área.
        return {
            deleted_at: null,
            fecha_inicio: { lte: fin },
            OR: [{ fecha_cese: null }, { fecha_cese: { gte: inicio } }],
            ...(dto.empleado_id ? { id: dto.empleado_id } : {}),
            ...(dto.area_id ? { area_id: dto.area_id } : {})
        };
    }

    /**
     * Procesa la generación de la planilla para un empleado específico, manejando los errores de negocio y técnicos.
     * @param job - El trabajo que contiene los datos necesarios para el procesamiento masivo, incluyendo el período, empleado y área.
     * @param empleadoId - El ID del empleado para el cual se generará la planilla.
     * @returns - Un objeto con el detalle del error si ocurre un error de negocio, o null si la planilla se genera correctamente.
     * @throws Error si ocurre un error técnico durante la generación de la planilla.
     */
    private async procesarEmpleado(job: Job<JobPayrollData>, empleadoId: string): Promise<ErrorEmpleado | null> {
        //Desestructura el DTO y el actor del trabajo para obtener los datos necesarios para la generación de la planilla.
        const { dto, actor } = job.data;

        //Intenta generar la planilla para el empleado, manejando los errores de negocio y técnicos.
        try {
            //Un reintento reconoce los resultados que ya produjo este mismo trabajo.
            const anterior = await this.prisma.historial_planillas.findUnique({
                where: { empleado_id_periodo: { empleado_id: empleadoId, periodo: dto.periodo } },
                select: { estado: true, snapshot_calculo: true }
            });

            //Si no existe un registro anterior o el estado no es 'CONGELADO' o 'DECLARADO', 
            //o si el trabajo_id del snapshot no coincide con el ID del trabajo actual, se genera la planilla para el empleado.
            const snapshot = anterior?.snapshot_calculo as { trabajo_id?: string } | null;
            //Genera la planilla para el empleado, pasando el ID del empleado, el período, el actor y el ID del trabajo actual.
            if (!anterior || !['CONGELADO', 'DECLARADO'].includes(anterior.estado) || snapshot?.trabajo_id !== job.id)
                await this.generarPlanilla.execute(empleadoId, dto.periodo, actor, job.id);
            return null;
        } catch (error) {
            //Los errores técnicos se reintentan por BullMQ; las reglas de negocio se informan por empleado.
            if (!(error instanceof HttpException) || error.getStatus() >= 500) throw error;
            return { empleado_id: empleadoId, detalle: error.message };
        }
    }
}

/**
 * Determina el estado del procesamiento masivo de planillas según la cantidad de planillas generadas correctamente y fallidas.
 * @param correctos - La cantidad de planillas generadas correctamente.
 * @param fallidos - La cantidad de planillas que fallaron durante el procesamiento.
 * @returns -  Un string que representa el estado del procesamiento: 'COMPLETADO' si no hay fallidos, 
 * 'PARCIAL' si hay correctos y fallidos, o 'FALLIDO' si no hay correctos.
 */
function estadoResultado(correctos: number, fallidos: number): string {
    if (!fallidos) return 'COMPLETADO';
    return correctos ? 'PARCIAL' : 'FALLIDO';
}

/**
 * Registra un error en el informe de errores.
 * El informe de errores está acotado para no crecer con el tamaño total de la nómina.
 * @param errores - El array de errores.
 * @param error - El error a registrar.
 */
function registrarError(errores: ErrorEmpleado[], error: ErrorEmpleado): void {
    if (errores.length < 100) errores.push(error);
}
