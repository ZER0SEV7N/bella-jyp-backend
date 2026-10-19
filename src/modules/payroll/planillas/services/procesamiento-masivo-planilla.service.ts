import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import type { JobPayrollData } from '@/workers/calculo-masivo/payroll.processor';
import { HttpException, Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { GenerarPlanillaUseCase } from '../use-case/planillas/generarPlanilla.useCase';

type ErrorEmpleado = { empleado_id: string; detalle: string };

/** Organiza los lotes; el caso de uso individual conserva el cálculo y su persistencia atómica. */
@Injectable()
export class ProcesamientoMasivoPlanillasService {
    constructor(private readonly prisma: PrismaService, 
        private readonly generarPlanilla: GenerarPlanillaUseCase) {}

    async procesar(job: Job<JobPayrollData>) {
        const where = this.filtros(job.data);
        const total = await this.prisma.empleados.count({ where });
        if (!total) throw new Error('No existen colaboradores dentro del período y los filtros solicitados.');
        let cursor: string | undefined,
            procesados = 0,
            correctos = 0,
            fallidos = 0;
        const errores: ErrorEmpleado[] = [];
        while (true) {
            const empleados = await this.prisma.empleados.findMany({
                where,
                select: { id: true },
                orderBy: { id: 'asc' },
                take: 50,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
            });
            if (!empleados.length) break;
            for (const empleado of empleados) {
                const error = await this.procesarEmpleado(job, empleado.id);
                if (error) {
                    fallidos++;
                    registrarError(errores, error);
                } else correctos++;
                procesados++;
                await job.updateProgress({ total, procesados, correctos, fallidos });
            }
            cursor = empleados.at(-1)!.id;
        }
        return { estado: estadoResultado(correctos, fallidos), total: procesados, correctos, fallidos, errores, errores_truncados: fallidos > errores.length };
    }

    private filtros({ dto }: JobPayrollData) {
        const { year, month } = ServerTime.validarPeriodo(dto.periodo);
        const inicio = ServerTime.desdeFechaSimple(`${dto.periodo}-01`),
            fin = new Date(Date.UTC(year, month, 0));
        return {
            deleted_at: null,
            fecha_inicio: { lte: fin },
            OR: [{ fecha_cese: null }, { fecha_cese: { gte: inicio } }],
            ...(dto.empleado_id ? { id: dto.empleado_id } : {}),
            ...(dto.area_id ? { area_id: dto.area_id } : {})
        };
    }

    private async procesarEmpleado(job: Job<JobPayrollData>, empleadoId: string): Promise<ErrorEmpleado | null> {
        const { dto, actor } = job.data;
        try {
            //Un reintento reconoce los resultados que ya produjo este mismo trabajo.
            const anterior = await this.prisma.historial_planillas.findUnique({
                where: { empleado_id_periodo: { empleado_id: empleadoId, periodo: dto.periodo } },
                select: { estado: true, snapshot_calculo: true }
            });
            const snapshot = anterior?.snapshot_calculo as { trabajo_id?: string } | null;
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

function estadoResultado(correctos: number, fallidos: number): string {
    if (!fallidos) return 'COMPLETADO';
    return correctos ? 'PARCIAL' : 'FALLIDO';
}

/** El informe de errores está acotado para no crecer con el tamaño total de la nómina. */
function registrarError(errores: ErrorEmpleado[], error: ErrorEmpleado): void {
    if (errores.length < 100) errores.push(error);
}
