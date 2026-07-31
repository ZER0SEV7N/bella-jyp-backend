/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
//src/modules/RRHH/use-cases/empleado/ObtenerEmpleados.useCase.ts
//Caso de uso para obtener empleados con paginación y filtros en el módulo de RRHH
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ObtenerEmpleadosQueryDto } from '@jyp/shared-contracts';

@Injectable()
export class ObtenerEmpleadosUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ObtenerEmpleadosQueryDto) {
    const { page, limit, area_id, cargo_id, activo } = query; //Desestructurar los parámetros de consulta
    const skip = (page - 1) * limit; //Calcular el número de registros a omitir para la paginación

    //Construir el objeto de filtros dinámicamente según los parámetros proporcionados
    const whereClause: any = { deleted_at: null }; //Solo empleados no eliminados

    //Agregar filtros condicionales
    if (area_id) whereClause.area_id = area_id;
    if (cargo_id) whereClause.cargo_id = cargo_id;
    if (activo !== undefined) whereClause.activo = activo;

    //Ejecutar la consulta a la base de datos utilizando Prisma
    const [total, empleados] = await this.prisma.$transaction([
      this.prisma.empleados.count({ where: whereClause }), //Contar el total de empleados que cumplen con los filtros
      this.prisma.empleados.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { apellido: 'asc' }, //Ordenar por apellido ascendente
        include: {
          area: { select: { nombre: true } },
          cargo: { select: { nombre: true } },
          estado_empleado: { select: { descripcion: true } },
        },
      }),
    ]);

    //Retornar los resultados junto con la información de paginación
    return {
      data: empleados,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
