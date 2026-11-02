//src/workers/calculo-masivo/payroll.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { GenerarPlanillasDto } from '@jyp/shared-contracts';
import { ProcesamientoMasivoPlanillasService } from '@/modules/payroll/planillas/services/procesamiento-masivo-planilla.service';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';

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
@Processor(COLA_PAYROLL, { concurrency: 1 })
export class PayrollProcessor extends WorkerHost {
    constructor(private readonly procesamiento: ProcesamientoMasivoPlanillasService) {
        super();
    }
    process(job: Job<JobPayrollData>) {
        return this.procesamiento.procesar(job);
    }
}
