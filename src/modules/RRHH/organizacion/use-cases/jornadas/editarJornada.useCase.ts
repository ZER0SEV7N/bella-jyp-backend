//src/modules/RRHH/use-cases/jornadas/editarJornada.useCase.ts
//Caso de uso para editar una jornada laboral existente
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActualizarJornadaDto } from '@jyp/shared-contracts';
import { sanitizarTexto } from '@/common/utils/transformacion.util';
import { procesarYValidarHorarioSemanal, verificarNombreJornadaUnico, verificarAreasJornada } from './helper/jornada.helper';

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
  async execute(id: string, dto: ActualizarJornadaDto) {
    try {
      const jornadaActual = await this.prisma.jornada.findUnique({ where: { id, deleted_at: null } });

      if (!jornadaActual) throw new NotFoundException({
        title: 'Jornada no encontrada',
        detail: 'El turno/jornada no existe o ha sido eliminado.'
      });
      
      if (dto.nombre && dto.nombre.trim() !== jornadaActual.nombre) await verificarNombreJornadaUnico(this.prisma, dto.nombre, id);
    
      if (dto.areas_ids) await verificarAreasJornada(this.prisma, dto.areas_ids);
      
      let totalHorasSemana: number | undefined;
      let horarioSemanalData: any | undefined;

      if (dto.horario_semanal) {
        const duracion = dto.duracion || jornadaActual.duracion;
        const turno = dto.turno || jornadaActual.turno;
        const patronRotacion = dto.patron_rotacion !== undefined ? dto.patron_rotacion : jornadaActual.patron_rotacion;

        const resultado = procesarYValidarHorarioSemanal(dto.horario_semanal, duracion, turno, patronRotacion);
        totalHorasSemana = resultado.totalSemanal;
        horarioSemanalData = resultado.horarioCalculado;
      }

      return await this.prisma.$transaction(async (tx) => {
        if (dto.areas_ids) {
          await tx.jornada_area.deleteMany({ where: { jornada_id: id } });
          if (dto.areas_ids.length > 0) 
            await tx.jornada_area.createMany({
              data: dto.areas_ids.map((areaId) => ({
                jornada_id: id,
                area_id: areaId
              }))
            });
          
        }

        return await tx.jornada.update({
          where: { id },
          data: {
            nombre: sanitizarTexto(dto.nombre),
            descripcion: sanitizarTexto(dto.descripcion),
            duracion: dto.duracion,
            turno: dto.turno,
            modalidad: dto.modalidad,
            tolerancia_minutos: dto.tolerancia_minutos,
            total_horas_semana: totalHorasSemana,
            horario_semanal: horarioSemanalData,
            patron_rotacion: dto.patron_rotacion !== undefined ? (dto.patron_rotacion as any) : undefined,
            activo: dto.activo
          },
          include: {
            jornada_areas: { include: { area: { select: { id: true, nombre: true } } } }
          }
        });
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) 
        throw error;
      
      throw new InternalServerErrorException({
        title: 'Error al Actualizar Jornada',
        detail: error instanceof Error ? error.message : 'Fallo interno al actualizar la jornada.',
      });
    }
  }
}