//src/modules/RRHH/use-cases/jornadas/editarJornada.useCase.ts
//Caso de uso para editar una jornada laboral existente
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActualizarJornadaDto } from '@jyp/shared-contracts';
import { sanitizarTexto } from '@/common/utils/transformacion.util';
import {
  procesarYValidarHorarioSemanal,
  verificarNombreJornadaUnico,
  verificarAreasJornada,
} from './helper/jornada.helper';
/**
 * Caso de uso para editar una jornada laboral existente en el sistema.
 * Permite a los usuarios con los roles adecuados (ADMIN, RRHH)
 * actualizar los detalles de una jornada laboral proporcionando los datos necesarios.
 */
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
   * @param dto - Los datos actualizados de la jornada laboral.
   * @returns La jornada laboral actualizada junto con el conteo de empleados asignados y aviso de asistencia si aplica.
   * @throws {NotFoundException} Si la jornada laboral no existe o está eliminada.
   */
  async execute(id: string, dto: ActualizarJornadaDto) {
    // Validar la existencia de la jornada antes de intentar actualizarla
    const jornadaActual = await this.prisma.jornada.findUnique({ where: { id, deleted_at: null } });

    if (!jornadaActual) {
      throw new NotFoundException({
        title: 'Jornada no encontrada',
        detail: 'El turno/jornada no existe o ha sido eliminado.',
      });
    }

    // Validar que el nombre de la jornada sea único si se proporciona un nuevo nombre
    if (dto.nombre && dto.nombre.trim() !== jornadaActual.nombre) {
      await verificarNombreJornadaUnico(this.prisma, dto.nombre, id);
    }

    // Validar las áreas asociadas a la jornada si se proporcionan
    if (dto.areas_ids) {
      await verificarAreasJornada(this.prisma, dto.areas_ids);
    }

    // Procesar y validar el horario semanal si se proporciona
    let totalHorasSemana: number | undefined;
    let horarioSemanalData:
      | ReturnType<typeof procesarYValidarHorarioSemanal>['horarioCalculado']
      | undefined;

    // Si se proporciona un horario semanal, procesarlo y validarlo
    if (dto.horario_semanal) {
      const duracion = dto.duracion || jornadaActual.duracion;
      const turno = dto.turno || jornadaActual.turno;
      const patronRotacion = dto.patron_rotacion ?? jornadaActual.patron_rotacion;

      const resultado = procesarYValidarHorarioSemanal(
        dto.horario_semanal,
        duracion,
        turno,
        patronRotacion,
      );
      totalHorasSemana = resultado.totalSemanal;
      horarioSemanalData = resultado.horarioCalculado;
    }

    // Ejecutar la transacción para actualizar la jornada y sus áreas asociadas
    return await this.prisma.$transaction(async (tx) => {
      if (dto.areas_ids) {
        await tx.jornada_area.deleteMany({ where: { jornada_id: id } });
        if (dto.areas_ids.length > 0) {
          await tx.jornada_area.createMany({
            data: dto.areas_ids.map((areaId) => ({
              jornada_id: id,
              area_id: areaId,
            })),
          });
        }
      }

      const jornadaActualizada = await tx.jornada.update({
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
          patron_rotacion:
            dto.patron_rotacion !== undefined ? (dto.patron_rotacion as any) : undefined,
          activo: dto.activo,
        },
        include: {
          jornada_areas: { include: { area: { select: { id: true, nombre: true } } } },
        },
      });

      // JOR-F1: Informar cuántos empleados activos tienen asignada esta jornada
      const empleadosAfectados = await tx.empleados.count({
        where: { jornada_id: id, deleted_at: null },
      });

      return {
        ...jornadaActualizada,
        empleados_afectados: empleadosAfectados,
        ...(dto.horario_semanal && empleadosAfectados > 0
          ? {
              aviso_asistencia:
                'El cambio de horario solo aplica a nuevas asignaciones; los historiales existentes en asistencia se preservan.',
            }
          : {}),
      };
    });
  }
}