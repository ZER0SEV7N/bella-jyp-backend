//src/modules/payroll/planillas/use-case/solicitarGeneracionPlanilla.useCase.ts
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';
import type { GenerarPlanillasDto } from '@jyp/shared-contracts';
import { Injectable } from '@nestjs/common';
import { ColaPayrollService } from '../services/cola-payroll.service';

/**
 * Caso de uso para solicitar la generación de planillas de manera masiva.
 * Este caso de uso delega la solicitud al servicio de cola de trabajos, que maneja la interacción con BullMQ y la base de datos.
 * @requires - ColaPayrollService para encolar la solicitud de generación de planillas.
 */
@Injectable()
export class SolicitarGeneracionPlanillasUseCase {
    constructor(private readonly cola: ColaPayrollService) {}

    /**
     * Solicita la generación de planillas de manera masiva.
     * @param dto - Objeto que contiene los datos necesarios para generar las planillas, incluyendo el período y los filtros de empleados.
     * @param actor - Objeto que representa al actor que realiza la operación, incluyendo su identificador y rol.
     * @returns - Promesa que se resuelve con el identificador del trabajo encolado si la operación es exitosa.
     * @throws HttpException si ocurre un error al encolar la solicitud.
     */
    execute(dto: GenerarPlanillasDto, actor: ActorOperacion) {
        return this.cola.encolar(dto, actor);
    }
}
