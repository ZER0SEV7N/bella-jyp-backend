//src/modules/RRHH/use-cases/jornadas/crearJornada.useCase.ts
//Caso de uso para crear una nueva jornada laboral
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearJornadaDto } from '@jyp/shared-contracts';

@Injectable()
export class CrearJornadaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(payload: CrearJornadaDto) {
    try {
      //Verificar si ya existe una jornada con el mismo nombre
      const jornadaExistente = await this.prisma.jornada.findFirst({ where: { nombre: payload.nombre } });

      if (jornadaExistente) throw new BadRequestException({
          title: 'Jornada duplicada',
          detail: `Ya existe una jornada/turno con el nombre '${payload.nombre}'.`,
        });

      //Crear la nueva jornada laboral en la base de datos
      return await this.prisma.jornada.create({
        data: {
          id: IdentityGenerator.generateId(),
          nombre: payload.nombre,
          hora_entrada: new Date(payload.hora_entrada),
          hora_salida: new Date(payload.hora_salida),
          tolerancia_minutos: payload.tolerancia_minutos,
          activo: true,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Error al crear la jornada laboral.');
    }
  }
}
