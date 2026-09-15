//src/modules/RRHH/use-cases/jornadas/crearJornada.useCase.ts
//Caso de uso para crear una nueva jornada laboral
import { Injectable, BadRequestException,InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearJornadaDto } from '@jyp/shared-contracts';
import { sanitizarTexto } from '@/common/utils/transformacion.util';
import { procesarYValidarHorarioSemanal, verificarNombreJornadaUnico, verificarAreasJornada } from './helper/jornada.helper';

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
  async execute(dto: CrearJornadaDto) {
    try {
      //Validar que el nombre de la jornada sea único y que las áreas asociadas existan y estén activas
      await verificarNombreJornadaUnico(this.prisma, dto.nombre);
      await verificarAreasJornada(this.prisma, dto.areas_ids);

      //Procesar y validar el horario semanal de la jornada, calculando el total de horas semanales y el horario final
      const { totalSemanal, horarioCalculado } = procesarYValidarHorarioSemanal(
        dto.horario_semanal,
        dto.duracion,
        dto.turno,
        dto.patron_rotacion,
      );

      //Generar un ID único para la nueva jornada laboral
      const jornadaId = IdentityGenerator.generateId();

      //Crear la nueva jornada laboral en la base de datos dentro de una transacción para asegurar consistencia
      return await this.prisma.$transaction(async (tx) => {
        const nuevaJornada = await tx.jornada.create({
          data: {
            id: jornadaId,
            nombre: sanitizarTexto(dto.nombre),
            descripcion: sanitizarTexto(dto.descripcion),
            duracion: dto.duracion,
            turno: dto.turno,
            modalidad: dto.modalidad,
            tolerancia_minutos: dto.tolerancia_minutos,
            total_horas_semana: totalSemanal,
            horario_semanal: horarioCalculado as any,
            patron_rotacion: dto.patron_rotacion ? (dto.patron_rotacion as any) : undefined,
            activo: dto.activo ?? true
          }
        });

        //Si se proporcionaron áreas asociadas, crear las relaciones en la tabla pivote
        if (dto.areas_ids?.length) await tx.jornada_area.createMany({
          data: dto.areas_ids.map((areaId) => ({
            jornada_id: jornadaId,
            area_id: areaId
          }))
        });
        
        return { ...nuevaJornada, areas_aplicables_ids: dto.areas_ids ?? [] };
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) 
        throw error;
      
      throw new InternalServerErrorException({
        title: 'Error al Crear Jornada',
        detail: error instanceof Error ? error.message : 'Fallo interno al registrar la nueva jornada.'
      });
    }
  }
}