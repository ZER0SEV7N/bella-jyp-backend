//src/modules/payroll/planillas/use-case/listarPlanilla.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarPlanillasDto } from '@jyp/shared-contracts';
import { Injectable } from '@nestjs/common';

/**
 * Caso de uso para listar planillas de un período específico.
 * Este caso de uso permite obtener un listado paginado de planillas para un período determinado, incluyendo la cantidad total de planillas y los datos de cada planilla.
 * @requires - PrismaService para acceder a la base de datos y consultar las planillas.
 */
@Injectable()
export class ListarPlanillasUseCase {
  constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para listar planillas de un período específico.
     * @param query - Objeto que contiene los parámetros de consulta, incluyendo el período, la página y el límite de resultados por página.
     * @returns - Promesa que se resuelve con un objeto que contiene el listado de planillas y la información de paginación si la operación es exitosa.
     * @throws HttpException si ocurre un error al consultar la base de datos.
     */
    async execute(query: ListarPlanillasDto) {
        const where = { periodo: query.periodo, deleted_at: null };
        const [total, data] = await this.prisma.$transaction([
            this.prisma.historial_planillas.count({ where }),
            this.prisma.historial_planillas.findMany({
                where,
                orderBy: { empleado_id: 'asc' },
                skip: (query.page - 1) * query.limit,
                take: query.limit,
                select: {
                    id: true,
                    empleado_id: true,
                    periodo: true,
                    estado: true,
                    sueldo_base: true,
                    total_ingresos: true,
                    total_descuentos: true,
                    neto_a_pagar: true,
                    empleados: { select: { nombre: true, apellido: true } },
                },
            }),
        ]);
        return { data, meta: { total, page: query.page, limit: query.limit } };
    }
}
