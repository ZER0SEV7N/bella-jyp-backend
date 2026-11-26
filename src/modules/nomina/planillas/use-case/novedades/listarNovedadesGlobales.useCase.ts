//src/modules/nomina/planillas/use-case/novedades/listarNovedadesGlobales.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ListarNovedadesGlobalesQuery } from '../../schemas/listar-novedades-globales.schema';

/**
 * Caso de uso para listar las novedades de planilla de todos los colaboradores (PLA-F5).
 * Permite al contador ver las novedades del período (con filtros de empleado y estado)
 * sin buscarlas una por una, devolviendo una respuesta paginada con el nombre del colaborador.
 */
@Injectable()
export class ListarNovedadesGlobalesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListarNovedadesGlobalesQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.novedad_planillaWhereInput = {};
    if (query.empleado_id) where.empleado_id = query.empleado_id;
    if (query.periodo) where.periodo = query.periodo;
    if (query.estado) where.estado = query.estado;

    const [total, novedades] = await Promise.all([
      this.prisma.novedad_planilla.count({ where }),
      this.prisma.novedad_planilla.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          empleado_id: true,
          periodo: true,
          tipo: true,
          monto: true,
          estado: true,
          motivo: true,
          created_at: true,
          empleado: { select: { nombre: true, apellido: true } },
        },
      }),
    ]);

    return {
      data: novedades.map((novedad) => ({
        id: novedad.id,
        empleado_id: novedad.empleado_id,
        colaborador:
          `${novedad.empleado.nombre} ${novedad.empleado.apellido}`.trim(),
        periodo: novedad.periodo,
        tipo: novedad.tipo,
        monto: novedad.monto,
        estado: novedad.estado,
        motivo: novedad.motivo,
        created_at: novedad.created_at,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
