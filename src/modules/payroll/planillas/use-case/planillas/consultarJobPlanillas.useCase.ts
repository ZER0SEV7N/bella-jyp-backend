//src/modules/payroll/planillas/use-case/consultarJobPlanillas.useCase.ts
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';
import { Injectable } from '@nestjs/common';
import { ColaPayrollService } from '../../services/cola-payroll.service';

/**
 * Caso de uso para consultar el estado y resultado de un trabajo de cálculo masivo de planillas.
 * Este caso de uso delega la consulta al servicio de cola de trabajos, que maneja la interacción con BullMQ y la base de datos.
 * @requires - ColaPayrollService para consultar el estado y resultado del trabajo en la cola.
 */
@Injectable()
export class ConsultarTrabajoPlanillasUseCase {
    constructor(private readonly cola: ColaPayrollService) {}
   
    /**
     * Consulta el estado y resultado de un trabajo de cálculo masivo de planillas.
     * @param id - Identificador del trabajo a consultar.
     * @param actor - Objeto que representa al actor que realiza la operación, incluyendo su identificador y rol.
     * @param rol - Rol del actor que realiza la operación, utilizado para validar permisos de acceso al trabajo.
     * @returns - Promesa que se resuelve con el estado, progreso y resultado del trabajo si la operación es exitosa.
     * @throws NotFoundException si el trabajo no existe o expiró su período de consulta.
     * @throws ForbiddenException si el actor no tiene permisos para consultar el trabajo.
     */
    execute(id: string, actor: ActorOperacion, rol: string) {
        return this.cola.consultar(id, actor, rol);
    }
}
