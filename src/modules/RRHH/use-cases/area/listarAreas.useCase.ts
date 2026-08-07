//src/modules/RRHH/use-cases/areas/listarAreas.useCase.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarAreasQueryDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para listar áreas con paginación y filtros en el módulo de RRHH
 */
@Injectable()
export class ListarAreasUseCase {
    constructor(private readonly prisma: PrismaService) {}

    async listar(query: ListarAreasQueryDto) {
        const { page, limit, activo } = query; //Desestructurar los parámetros de consulta
        const skip = (page - 1) * limit; //Calcular el número de registros a omitir para la paginación

        const where: any = { deleted_at: null }; //Solo áreas no eliminadas

        if(activo !== undefined) where.activo = activo; //Agregar filtro de estado si se proporciona

        //Ejecutar la consulta a la base de datos utilizando Prisma
        const [total, areas] = await this.prisma.$transaction([
            this.prisma.area.count({ where }), //Contar el total de áreas que cumplen con los filtros
            this.prisma.area.findMany({
                where: where,
                skip,
                take: limit,
                orderBy: { nombre: 'asc' }, //Ordenar por nombre ascendente
                include: {
                    _count: {
                        select: { cargo: {where: { deleted_at: null }} }, // Incluir el conteo de cargos asociados a cada área
                    },
                },
            }),
        ]);

        return {
            data: areas,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}