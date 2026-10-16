import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import type { GenerarPlanillasDto } from '@jyp/shared-contracts';
import { COLA_PAYROLL, JobPayrollData } from '@/workers/calculo-masivo/payroll.processor';
import type { ActorOperacion } from '@/modules/asistencia/services/asistencia-transaccion.helper';
import { ServerTime } from '@/common/utils/server-time';

@Injectable()
export class ColaPayrollService {
    constructor(@InjectQueue(COLA_PAYROLL) private readonly cola: Queue<JobPayrollData>) {}

    async encolar(dto: GenerarPlanillasDto, actor: ActorOperacion) {
        if (dto.periodo > ServerTime.obtenerPeriodoActual) throw new BadRequestException('No se puede encolar un período futuro.');
        const id = createHash('sha256').update(`${actor.id}|${dto.solicitud_id}`).digest('hex');
        const anterior = await this.cola.getJob(id);
        if (anterior && JSON.stringify(anterior.data.dto) !== JSON.stringify(dto)) throw new ConflictException('El identificador de solicitud ya se utilizó con otros filtros.');
        const job = anterior ?? await this.cola.add('calcular-planillas', { dto, actor }, { jobId: id, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { age: 7 * 86400 }, removeOnFail: { age: 30 * 86400 } });
        //Dos productores pueden competir por la misma clave; se contrasta el trabajo que Redis conservó.
        const confirmado = await this.cola.getJob(id);
        if (confirmado && JSON.stringify(confirmado.data.dto) !== JSON.stringify(dto)) throw new ConflictException('La clave de solicitud fue utilizada simultáneamente con otros filtros.');
        return { trabajo_id: job.id, estado: await job.getState(), consulta: `/api/payroll/planillas/trabajos/${job.id}` };
    }

    async consultar(id: string, actor: ActorOperacion, rol: string) {
        const job = await this.cola.getJob(id);
        if (!job) throw new NotFoundException('El trabajo no existe o expiró su período de consulta.');
        if (job.data.actor.id !== actor.id && !['ADMIN', 'CONTADOR'].includes(rol)) throw new ForbiddenException('No tiene acceso a este trabajo.');
        return { trabajo_id: id, estado: await job.getState(), progreso: job.progress, resultado: job.returnvalue ?? null, error: job.failedReason || null };
    }
}
