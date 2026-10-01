//src/modules/afp/use-cases/comision/listarComisiones.useCase.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarComisionesQueryDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para listar las comisiones de AFP.
 * Este caso de uso tiene como objetivo obtener una lista de comisiones de AFP desde la base de datos, con soporte para paginación y filtrado.
 * @param query - Objeto de transferencia de datos que contiene los parámetros de paginación y filtrado.
 * @returns Una lista de comisiones de AFP que cumplen con los criterios especificados en el objeto de consulta.
 */
@Injectable()
export class ListarComisionesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  //Maneja la lógica para listar las comisiones de AFP con paginación y filtrado
  async listar(query: ListarComisionesQueryDto) {
    const { page, limit, afp_id, solo_vigentes } = query;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    //Si se proporciona un afp_id, filtramos por ese ID
    if (afp_id) whereClause.afp_id = afp_id;
    //Si se solicita solo las comisiones vigentes, filtramos por periodo_final nulo
    if (solo_vigentes) whereClause.periodo_final = null;

    //Realizamos la consulta a la base de datos para obtener el total y las comisiones con paginación
    const [total, comisiones] = await this.prisma.$transaction([
      this.prisma.comisiones_afp.count({ where: whereClause }),
      this.prisma.comisiones_afp.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { periodo_inicio: 'desc' },
        include: {
          tipo_afp: { select: { id: true, nombre: true } }
        }
      })
    ]);

    //Mapeo limpio asegurando tipos numéricos para el frontend
    const dataFormateada = comisiones.map((c) => ({
      id: c.id,
      afp_id: c.afp_id,
      afp_nombre: c.tipo_afp?.nombre ?? 'Desconocida',
      periodo_inicio: c.periodo_inicio,
      periodo_final: c.periodo_final,
      aporte_obligatorio: Number(c.aporte_obligatorio),
      comision_sobre_ra: Number(c.comision_sobre_ra),
      prima_seguro: Number(c.prima_seguro),
      comision_mixta: Number(c.comision_mixta),
    }));

    //Retorna la data formateada junto con la información de paginación
    return {
      data: dataFormateada,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
  }
}