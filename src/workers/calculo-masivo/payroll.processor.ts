//src/workers/calculo-masivo/payroll.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { GenerarPlanillasDto } from '@jyp/shared-contracts';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PlanillasService } from '@/modules/payroll/planillas/services/planillas.service';
import { ServerTime } from '@/common/utils/server-time';
import type { ActorOperacion } from '@/modules/asistencia/services/asistencia-transaccion.helper';
import { HttpException } from '@nestjs/common';

/**
 * Processor de BullMQ para manejar el cálculo masivo de planillas.
 * Procesa cada job de cálculo de planilla de manera asíncrona, 
 * actualizando el estado del job en la base de datos y registrando los errores ocurridos durante el procesamiento.
 * @requires - PrismaService para interactuar con la base de datos.
 * @requires - PlanillasService para ejecutar la lógica de cálculo de planillas.
 * @requires - ServerTime para obtener la fecha y hora del servidor.
 * @requires - ActorOperacion para registrar el actor que realiza la operación.
 */
export const COLA_PAYROLL = 'payroll-calculo';
export interface JobPayrollData { dto: GenerarPlanillasDto; actor: ActorOperacion; }
type ErrorPayroll = { empleado_id: string; detalle: string };

/**
 * Clase que representa el processor de BullMQ para el cálculo masivo de planillas.
 * @extends WorkerHost - Clase base de BullMQ para procesadores de trabajos.
 * @implements Processor<JobPayrollData> - Interfaz que define el tipo de datos que se procesan en los jobs.
 */
@Processor(COLA_PAYROLL, { concurrency: 1 }) //Se asegura de que solo un job se procese a la vez para evitar conflictos de concurrencia
export class PayrollProcessor extends WorkerHost {
    constructor(
        private readonly prisma: PrismaService,
        private readonly planillas: PlanillasService,
    ) { super(); }

    async process(job: Job<JobPayrollData>): Promise<void> {
        const { dto, actor } = job.data;
        const { year, month } = ServerTime.validarPeriodo(dto.periodo);
        const inicio = ServerTime.desdeFechaSimple(`${dto.periodo}-01`), fin = new Date(Date.UTC(year, month, 0));
        const where = { deleted_at: null, fecha_inicio: { lte: fin }, OR: [{ fecha_cese: null }, { fecha_cese: { gte: inicio } }], 
            ...(dto.empleado_id ? { id: dto.empleado_id } : {}), ...(dto.area_id ? { area_id: dto.area_id } : {}) };
        
        const total = await this.prisma.empleados.count({ where });
        if(!total) throw new Error(`No existen colaboradores dentros del período y los filtros solicitados.`);
        
        let cursor: string | undefined, procesados = 0, correctos = 0, fallidos = 0;
        const errores: ErrorPayroll[] = [];

        while (true) {
            const empleados = await this.prisma.empleados.findMany({ where, select: { id: true }, orderBy: { id: 'asc' }, take: 50, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
            if (!empleados.length) break;
            for (const empleado of empleados) {
                const resultado = await this.procesarEmpleado(empleado.id, dto, actor, job.id, errores);
                correctos += Number(resultado);
                fallidos += Number(!resultado);
                procesados++;
                await job.updateProgress({ total, procesados, correctos, fallidos });
            }
            cursor = empleados.at(-1)!.id;
        }
        let estado: 'PARCIAL' | 'FALLIDO' | 'COMPLETADO';
        if (!fallidos) estado = 'COMPLETADO';
        else if (correctos) estado = 'PARCIAL';
        else estado = 'FALLIDO';

        return { estado, total: procesados, correctos, fallidos, errores, errores_truncados: fallidos > errores.length };
    }

    private async procesarEmpleado(
        empleadoId: string,
        dto: GenerarPlanillasDto,
        actor: ActorOperacion,
        trabajoId: string,
        errores: ErrorPayroll[],
    ): Promise<boolean> {
        try {
            const anterior = await this.prisma.historial_planillas.findUnique({
                where: { empleado_id_periodo: { empleado_id: empleadoId, periodo: dto.periodo } },
                select: { estado: true, snapshot_calculo: true },
            });
            const snapshot = anterior?.snapshot_calculo as { trabajo_id?: string } | null;
            const yaProcesado = anterior !== null
                && ['CONGELADO', 'DECLARADO'].includes(anterior.estado)
                && snapshot?.trabajo_id === trabajoId;
            if (!yaProcesado) await this.planillas.generar(empleadoId, dto.periodo, actor, trabajoId);
            return true;
        } catch (error) {
            if (!this.esErrorDeNegocio(error)) throw error;
            if (errores.length < 100) errores.push({ empleado_id: empleadoId, detalle: this.detalleError(error) });
            return false;
        }
    }

    private esErrorDeNegocio(error: unknown): error is HttpException {
        return error instanceof HttpException && error.getStatus() < 500;
    }

    private detalleError(error: unknown): string {
        return error instanceof Error ? error.message : 'Error de cálculo.';
    }
}
