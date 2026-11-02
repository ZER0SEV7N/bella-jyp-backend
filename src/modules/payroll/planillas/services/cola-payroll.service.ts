//src/modules/payroll/planillas/services/cola-payroll.service.ts
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import type { GenerarPlanillasDto } from '@jyp/shared-contracts';
import { COLA_PAYROLL, JobPayrollData } from '@/workers/calculo-masivo/payroll.processor';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';
import { ServerTime } from '@/common/utils/server-time';

/**
 * Servicio para la gestión de la cola de procesamiento masivo de planillas.
 * Este servicio permite encolar trabajos de generación masiva de planillas y consultar el estado de los trabajos en la cola.
 * @requires - InjectQueue para inyectar la cola de procesamiento masivo de planillas.
 * @requires - ServerTime para validar que el período no sea futuro al encolar un trabajo.
 */
@Injectable()
export class ColaPayrollService {
    constructor(@InjectQueue(COLA_PAYROLL) private readonly cola: Queue<JobPayrollData>) {}

    /**
     * Encola un trabajo de generación masiva de planillas para los empleados que cumplen con los filtros especificados.
     * @param dto - Los datos necesarios para generar las planillas, incluyendo el período, empleado y área.
     * @param actor - La información del actor que realiza la operación, incluyendo su ID y dirección IP.
     * @returns - Un objeto con el ID del trabajo encolado, su estado y la URL de consulta.
     * @throws - BadRequestException si el período es futuro.
     * @throws - ConflictException si el identificador de solicitud ya se utilizó con otros filtros.
     * @throws - ConflictException si la clave de solicitud fue utilizada simultáneamente con otros filtros.
     */
    async encolar(dto: GenerarPlanillasDto, actor: ActorOperacion) {
        //Valida que el período no sea futuro antes de encolar el trabajo.
        if (dto.periodo > ServerTime.obtenerPeriodoActual) 
            throw new BadRequestException('No se puede encolar un período futuro.');

        //Crea un hash SHA-256 a partir del ID del actor y el ID de la solicitud para generar un identificador único para el trabajo.
        const id = createHash('sha256').update(`${actor.id}|${dto.solicitud_id}`).digest('hex');
        
        //Verifica si ya existe un trabajo en la cola con el mismo ID y diferentes filtros, lanzando una excepción si es así.
        const anterior = await this.cola.getJob(id);
        if (anterior && JSON.stringify(anterior.data.dto) !== JSON.stringify(dto)) 
            throw new ConflictException('El identificador de solicitud ya se utilizó con otros filtros.');
        
        //Encola el trabajo de generación masiva de planillas, estableciendo el ID del trabajo, el número de intentos y la política de reintentos.
        const job = anterior ?? await this.cola.add('calcular-planillas', 
            { dto, actor }, 
            { jobId: id, attempts: 3, 
                backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { age: 7 * 86400 }, removeOnFail: { age: 30 * 86400 } });
        //Dos productores pueden competir por la misma clave; se contrasta el trabajo que Redis conservó.
        const confirmado = await this.cola.getJob(id);
        if (confirmado && JSON.stringify(confirmado.data.dto) !== JSON.stringify(dto)) 
            throw new ConflictException('La clave de solicitud fue utilizada simultáneamente con otros filtros.');
        
        //Devuelve el ID del trabajo encolado, su estado y la URL de consulta.
        return { trabajo_id: job.id, estado: await job.getState(), consulta: `/api/payroll/planillas/trabajos/${job.id}` };
    }

    /**
     * Consulta el estado de un trabajo de generación masiva de planillas en la cola.
     * @param id - El ID del trabajo a consultar.
     * @param actor - La información del actor que realiza la consulta, incluyendo su ID y dirección IP.
     */
    async consultar(id: string, actor: ActorOperacion, rol: string) {
        //Obtiene el trabajo de la cola por su ID y lanza una excepción si no existe o si expiró su período de consulta.
        const job = await this.cola.getJob(id);
        //Valida que el actor que realiza la consulta sea el mismo que encoló el trabajo o tenga un rol autorizado, lanzando una excepción si no tiene acceso.
        if (!job) 
            throw new NotFoundException('El trabajo no existe o expiró su período de consulta.');
        
        //Valida que el actor que realiza la consulta sea el mismo que encoló el trabajo o tenga un rol autorizado, lanzando una excepción si no tiene acceso.
        if (job.data.actor.id !== actor.id && !['ADMIN', 'CONTADOR'].includes(rol)) 
            throw new ForbiddenException('No tiene acceso a este trabajo.');

        //Devuelve el estado del trabajo, incluyendo su ID, estado, progreso, resultado y cualquier error ocurrido.
        return { trabajo_id: id, estado: await job.getState(), progreso: job.progress, resultado: job.returnvalue ?? null, error: job.failedReason || null };
    }
}
