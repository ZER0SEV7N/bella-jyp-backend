//src/modules/tareas/use-cases/ObtenerTareas.useCase.ts
//Caso de uso para obtener una lista de tareas según ciertos criterios de filtrado y paginación.
//Se encarga de validar los parámetros de consulta, aplicar filtros y devolver un conjunto de tareas que cumplan con los criterios especificados.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ObtenerTareasQueryDto } from '@jyp/shared-contracts';

@Injectable()
export class ObtenerTareasUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ObtenerTareasQueryDto,
    userRequesting: { id: string; rol: string },
  ) {
    const { page, limit, estado } = query;
    const skip = (page - 1) * limit;

    const where: any = { deleted_at: null };
    if (estado) where.estado = estado;

    //Privacidad del usuario: Si el usuario no es CONTADOR, solo puede ver sus propias tareas
    if (userRequesting.rol === 'ASISTENTE')
      where.asignado_a = userRequesting.id;
    else if (userRequesting.rol === 'CONTADOR') {
      where.OR = [
        { asignado_a: userRequesting.id },
        { asignado_por: userRequesting.id },
      ];
    }
    //Ver todas las tareas si es ADMIN o SUPERADMIN (JYP)

    const [total, tareas] = await this.prisma.$transaction([
      this.prisma.tareas_asistente.count({ where: where }),
      this.prisma.tareas_asistente.findMany({
        where: where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          //Incluimos datos para la interfaz gráfica
          usuarios_tareas_asistente_asignado_aTousuarios: {
            select: { email: true, rol: true },
          },
          usuarios_tareas_asistente_asignado_porTousuarios: {
            select: { email: true, rol: true },
          },
          _count: { select: { anotacion_tareas: true } }, // Cuenta cuántos comentarios tiene
        },
      }),
    ]);

    //Devolvemos los datos junto con la información de paginación
    return {
      data: tareas,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
