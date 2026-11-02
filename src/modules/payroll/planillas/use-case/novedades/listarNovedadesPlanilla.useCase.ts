//src/modules/payroll/planillas/use-case/novedades/listarNovedadesPlanilla.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

/**
 * Caso de uso para listar las novedades de una planilla de un empleado específico.
 * Este caso de uso permite obtener un listado de novedades asociadas a una planilla para un empleado determinado, ordenadas por fecha de creación.
 * @requires - PrismaService para acceder a la base de datos y consultar las novedades de la planilla.
 */
@Injectable()
export class ListarNovedadesPlanillaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para listar las novedades de una planilla de un empleado específico.
     * @param empleadoId - Identificador del empleado para el cual se desean listar las novedades de la planilla.
     * @param periodo - Período de la planilla para el cual se desean listar las novedades.
     * @returns - Promesa que se resuelve con un arreglo de novedades de la planilla si la operación es exitosa.
     * @throws HttpException si ocurre un error al consultar la base de datos.
     */
    execute(empleadoId: string, periodo: string) {
        return this.prisma.novedad_planilla.findMany({ where: { empleado_id: empleadoId, periodo }, orderBy: { created_at: 'asc' }, take: 100 });
    }
}
