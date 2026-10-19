//src/modules/payroll/planillas/use-case/obtenerPlanilla.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';

/**
 * Caso de uso para obtener una planilla de un empleado.
 * Este caso de uso valida que la planilla exista antes de devolverla.
 * @requires - PrismaService para acceder a la base de datos y consultar la planilla.
 */
@Injectable()
export class ObtenerPlanillaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para obtener una planilla de un empleado.
     * Valida que la planilla exista antes de devolverla.
     * @param id - Identificador de la planilla a obtener.
     * @returns - Promesa que se resuelve con la planilla si la operación es exitosa.
     * @throws NotFoundException si la planilla no existe.
     */
    async execute(id: string) {
        const planilla = await this.prisma.historial_planillas.findUnique({ where: { id, deleted_at: null } });
        if (!planilla) throw new NotFoundException('La planilla no existe.');
        return planilla;
    }
}
