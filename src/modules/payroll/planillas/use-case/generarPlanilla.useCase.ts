import { Injectable } from '@nestjs/common';
import { PlanillasService } from '../services/planillas.service';
import type { ActorOperacion } from '@/modules/asistencia/services/asistencia-transaccion.helper';

/** Caso de uso individual conservado para consumidores internos; el período se recibe explícitamente. */
@Injectable()
export class GenerarPlanillaUseCase {
    constructor(private readonly planillas: PlanillasService) {}
    async execute(empleadoId: string, periodo: string, actor: ActorOperacion) {
        return this.planillas.generar(empleadoId, periodo, actor);
    }
}
