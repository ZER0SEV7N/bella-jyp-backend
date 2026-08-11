//src/modules/RRHH/use-cases/jornadas/editarJornada.useCase.ts
//Caso de uso para editar una jornada laboral existente
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActualizarJornadaDto } from '@jyp/shared-contracts';

@Injectable()
export class EditarJornadaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string, payload: ActualizarJornadaDto) {
    //Verificar si la jornada laboral existe y no está eliminada
    const jornada = await this.prisma.jornada.findUnique({ where: { id } });

    if (!jornada || jornada.deleted_at !== null)
      throw new NotFoundException({
        title: 'Jornada no encontrada',
        detail: 'El turno no existe o ha sido eliminado.',
      });

    return await this.prisma.jornada.update({
      where: { id },
      data: {
        nombre: payload.nombre,
        hora_entrada: payload.hora_entrada
          ? new Date(payload.hora_entrada)
          : undefined,
        hora_salida: payload.hora_salida
          ? new Date(payload.hora_salida)
          : undefined,
        tolerancia_minutos: payload.tolerancia_minutos,
      },
    });
  }
}
