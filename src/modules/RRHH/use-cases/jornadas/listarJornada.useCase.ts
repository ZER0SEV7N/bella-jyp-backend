//src/modules/RRHH/use-cases/jornadas/listarJornada.useCase.ts
//Caso de uso para listar las jornadas laborales con paginación y filtrado
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarJornadasQueryDto } from '@jyp/shared-contracts';

@Injectable()
export class ListarJornadaUseCase {
  constructor(private readonly prisma: PrismaService) {}

<<<<<<< HEAD
    async execute(query: ListarJornadasQueryDto) {
        const { page, limit, activo } = query; //Obtener los parámetros de paginación y filtrado
        const skip = (page - 1) * limit; //Calcular el número de registros a omitir para la paginación
=======
  async execute(query: ObtenerJornadasQueryDto) {
    const { page, limit, activo } = query; //Obtener los parámetros de paginación y filtrado
    const skip = (page - 1) * limit; //Calcular el número de registros a omitir para la paginación
>>>>>>> feature/RrhhModule

    const where: any = { deleted_at: null }; //Construir el objeto de filtrado para la consulta
    if (activo !== undefined) where.activo = activo;

    //Ejecutar la consulta a la base de datos para obtener el total de jornadas y las jornadas paginadas
    const [total, jornadas] = await this.prisma.$transaction([
      this.prisma.jornada.count({ where: where }),
      this.prisma.jornada.findMany({
        where: where,
        skip,
        take: limit,
        orderBy: { nombre: 'asc' },
      }),
    ]);

    return {
      data: jornadas,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
