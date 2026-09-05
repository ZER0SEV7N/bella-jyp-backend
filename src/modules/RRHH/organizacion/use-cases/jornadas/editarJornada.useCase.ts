//src/modules/RRHH/use-cases/jornadas/editarJornada.useCase.ts
//Caso de uso para editar una jornada laboral existente
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActualizarJornadaDto } from '@jyp/shared-contracts';
import { calcularHorasDia } from './helper/fechaTiempo.helper';

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
      //Verificar si la jornada laboral existe y no está eliminada
      const jornadaActual = await this.prisma.jornada.findUnique({where: { id, deleted_at: null }});

      if (!jornadaActual) throw new NotFoundException({
        title: 'Jornada no encontrada',
        detail: 'El turno no existe o ha sido eliminado.'
      });

      await this.validarNombre(id, dto.nombre, jornadaActual.nombre);
      await this.validarAreas(dto.areas_ids);
      const { totalSemanal, horarioFinal } = this.calcularHorario(dto, jornadaActual);

      //Validaciones de límites laborales
      return await this.prisma.$transaction(async (tx) => {
        //Sincronizar áreas si fueron enviadas
        if (dto.areas_ids) {
          await tx.jornada_area.deleteMany({ where: { jornada_id: id } });
          await tx.jornada_area.createMany({
            data: dto.areas_ids.map((areaId) => ({
              jornada_id: id,
              area_id: areaId,
            }))
          });
        }

        //Actualizar la jornada con los nuevos datos
        return await tx.jornada.update({
          where: { id },
          data: {
            nombre: dto.nombre ? dto.nombre.trim() : undefined,
            descripcion: dto.descripcion !== undefined ? dto.descripcion : undefined,
            duracion: dto.duracion ?? undefined,
            turno: dto.turno ?? undefined,
            modalidad: dto.modalidad ?? undefined,
            tolerancia_minutos: dto.tolerancia_minutos ?? undefined,
            total_horas_semana: dto.horario_semanal ? totalSemanal : undefined,
            horario_semanal: horarioFinal,
            patron_rotacion: dto.patron_rotacion !== undefined ? (dto.patron_rotacion as any) : undefined,
            activo: dto.activo ?? undefined
          },
          include: { jornada_areas: { include: { area: { select: { id: true, nombre: true } } } } }
        });
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) 
        throw error;
      
      throw new InternalServerErrorException('Ocurrió un error al actualizar la jornada.', error instanceof Error ? error.message : undefined);
    }
  }

  /**
   * Metodo privado para validar que el nombre de la jornada no esté duplicado en el sistema.
   * Si el nombre proporcionado es diferente al nombre actual de la jornada, se verifica si ya existe otra jornada con ese nombre.
   * @param id - El ID de la jornada que se está editando.
   * @param nombre - El nuevo nombre propuesto para la jornada.
   * @param nombreActual - El nombre actual de la jornada antes de la edición.
   * @returns - Si el nombre es válido, no retorna nada. Si el nombre está duplicado, lanza una excepción BadRequestException.
   * @throws {BadRequestException} Si el nombre propuesto ya está en uso por otra jornada.
   */
  private async validarNombre(id: string, nombre: string | undefined, nombreActual: string) {
    if (!nombre || nombre.trim() === nombreActual) return;

    const nombreEnUso = await this.prisma.jornada.findFirst({ where: {
      nombre: { equals: nombre.trim(), mode: 'insensitive' },
      id: { not: id },
      deleted_at: null
    }});

    if (nombreEnUso) throw new BadRequestException({
      title: 'Nombre Duplicado',
      detail: `Ya existe otra jornada registrada con el nombre '${nombre}'.`
    });
  }

  /**
   * Metodo privado para validar que las áreas seleccionadas existan y estén activas.
   * @param areasIds - Un array con los IDs de las áreas a validar.
   * @returns - Si todas las áreas son válidas, no retorna nada. Si alguna área es inválida, lanza una excepción NotFoundException.
   * @throws {NotFoundException} Si una o más áreas seleccionadas no existen o están inactivas.
   */
  private async validarAreas(areasIds?: string[]) {
    if (!areasIds?.length) return;

    const areasExistentes = await this.prisma.area.count({where: { id: { in: areasIds }, activo: true, deleted_at: null }});

    if (areasExistentes !== areasIds.length) throw new NotFoundException({
      title: 'Áreas Inválidas',
      detail: 'Una o más áreas seleccionadas no existen o están inactivas.'
    });
  }

  /**
   * Metodo privado para calcular el horario de la jornada.
   * @param dto - El DTO con los datos de la jornada a actualizar.
   * @param jornadaActual - Los datos actuales de la jornada.
   * @returns - Un objeto con el total de horas semanales y el horario final.
   * @throws {BadRequestException} Si el horario configurado excede el límite legal.
   */
  private calcularHorario(dto: ActualizarJornadaDto, jornadaActual: any) {
    if (!dto.horario_semanal) return {
      totalSemanal: Number(jornadaActual.total_horas_semana),
      horarioFinal: jornadaActual.horario_semanal,
    };

    //Calcular el total de horas semanales según el horario configurado
    let totalSemanal = 0;
    const horarioFinal = dto.horario_semanal.map((dia) => {
      const horas = calcularHorasDia(dia);
      totalSemanal += horas;
      return { ...dia, total_horas: horas };
    }) as any;
    const duracionEvaluada = dto.duracion || jornadaActual.duracion;

    //Validaciones de límites laborales
if (duracionEvaluada === 'TIEMPO_PARCIAL' && totalSemanal >= 30) throw new BadRequestException({
      title: 'Límite de Horas Excedido',
      detail: `Una jornada a tiempo parcial no puede superar las 30 horas semanales (actual: ${totalSemanal}h).`
    });
    
    if (totalSemanal > 48) throw new BadRequestException({
      title: 'Jornada Máxima Excedida',
      detail: `El horario configurado (${totalSemanal}h) excede el límite legal de 48 horas semanales.`,
    });

    //Validación de patrón de rotación si el turno es ROTATIVO
    if (dto.turno === 'ROTATIVO' && !dto.patron_rotacion) throw new BadRequestException({
      title: 'Patrón de Rotación Requerido',
      detail: 'Para una jornada con turno rotativo, es necesario especificar el patrón de rotación.'
    });

    return { totalSemanal, horarioFinal };
  }

}