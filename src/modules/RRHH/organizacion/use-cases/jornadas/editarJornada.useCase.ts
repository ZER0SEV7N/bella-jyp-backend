//src/modules/RRHH/use-cases/jornadas/editarJornada.useCase.ts
//Caso de uso para editar una jornada laboral existente
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActualizarJornadaDto } from '@jyp/shared-contracts';
import { NormalizarTimeToDate } from './helper/fechaTiempo.helper';

/**
 * Caso de uso para editar una jornada laboral existente en el sistema.
 * Permite a los usuarios con los roles adecuados (ADMIN, RRHH)
 * actualizar los detalles de una jornada laboral proporcionando los datos necesarios.
 */
@Injectable()
export class EditarJornadaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para editar una jornada laboral existente.
   * @param id - El ID de la jornada laboral a editar.
   * @param payload - Los datos actualizados de la jornada laboral.
   * @returns La jornada laboral actualizada con sus nuevos detalles.
   * @throws {NotFoundException} Si la jornada laboral no existe o está eliminada.
   */
  async execute(id: string, payload: ActualizarJornadaDto) {
    try {
      //Verificar si la jornada laboral existe y no está eliminada
      const jornada = await this.prisma.jornada.findUnique({ where: { id } });

      if (jornada?.deleted_at !== null) throw new NotFoundException({
        title: 'Jornada no encontrada',
        detail: 'El turno no existe o ha sido eliminado.'
      });

      //Verificar si el nombre de la jornada laboral está siendo modificado y si ya existe otra jornada con el mismo nombre
      if (payload.nombre && payload.nombre.trim() !== jornada.nombre) {
        const nombreDuplicado = await this.prisma.jornada.findFirst({where: {
          nombre: { equals: payload.nombre.trim(), mode: 'insensitive' },
          id: { not: id },
          deleted_at: null
        }});
      
        if (nombreDuplicado) throw new BadRequestException({
          title: 'Nombre de jornada en uso',
          detail: `Ya existe otra jornada registrada con el nombre '${payload.nombre}'.`,
        });    
      }
      
      return await this.prisma.jornada.update({where: { id },
        data: {
          nombre: payload.nombre,
          tipo_jornada: payload.tipo_jornada ?? undefined,
          hora_entrada: payload.hora_entrada ? NormalizarTimeToDate(payload.hora_entrada) : undefined,
          hora_salida: payload.hora_salida ? NormalizarTimeToDate(payload.hora_salida) : undefined,
          tolerancia_minutos: payload.tolerancia_minutos
        }
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new BadRequestException('Error al actualizar la jornada laboral.');
    }
  };
}
