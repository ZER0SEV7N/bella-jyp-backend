//src/modules/RRHH/use-cases/jornadas/crearJornada.useCase.ts
//Caso de uso para crear una nueva jornada laboral
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { NormalizarTimeToDate } from './helper/fechaTiempo.helper';
import type { CrearJornadaDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para crear una nueva jornada laboral en el sistema.
 * Permite a los usuarios con los roles adecuados (ADMIN, RRHH) 
 * crear una jornada laboral proporcionando los detalles necesarios.
 */
@Injectable()
export class CrearJornadaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para crear una nueva jornada laboral.
   * @param payload - Datos de la nueva jornada laboral a crear.
   * @returns La jornada laboral creada con sus detalles.
   * @throws {BadRequestException} Si ya existe una jornada con el mismo nombre o si ocurre un error al crear la jornada.
   */
  async execute(payload: CrearJornadaDto) {
    try {
      //Verificar si ya existe una jornada con el mismo nombre
      const jornadaExistente = await this.prisma.jornada.findFirst({where: {
        nombre: { equals: payload.nombre.trim(), mode: 'insensitive' },
        deleted_at: null
      }});

      if (jornadaExistente)throw new BadRequestException({
        title: 'Jornada duplicada',
        detail: `Ya existe una jornada/turno con el nombre '${payload.nombre}'.`
      });

      //Crear la nueva jornada laboral en la base de datos
      return await this.prisma.jornada.create({
        data: {
          id: IdentityGenerator.generateId(),
          nombre: payload.nombre,
          tipo_jornada: payload.tipo_jornada ?? 'FIJA',
          hora_entrada: NormalizarTimeToDate(payload.hora_entrada),
          hora_salida: NormalizarTimeToDate(payload.hora_salida),
          tolerancia_minutos: payload.tolerancia_minutos ?? 0,
          activo: payload.activo ?? true
        }
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Error al crear la jornada laboral.');
    }
  }
}
