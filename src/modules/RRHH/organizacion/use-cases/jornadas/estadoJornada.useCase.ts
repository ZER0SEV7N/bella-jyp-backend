//src/modules/RRHH/use-cases/jornadas/estadoJornada.useCase.ts
//Caso de uso para cambiar el estado de una jornada laboral
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Caso de uso para cambiar el estado de una jornada laboral en el sistema.
 * Permite a los usuarios con los roles adecuados (ADMIN, RRHH) 
 * desactivar o reactivar una jornada laboral proporcionando su ID.
 */
@Injectable()
export class EstadoJornadaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Desactiva una jornada laboral existente en el sistema.
   * @param id - El ID de la jornada laboral a desactivar.
   * @returns La jornada laboral desactivada con sus detalles.
   * @throws {NotFoundException} Si la jornada laboral no existe o ya está eliminada.
   * @throws {BadRequestException} Si hay empleados activos asociados a la jornada laboral.
   */
  async desactivar(id: string) {
    //Verificar si la jornada laboral existe y no está eliminada
    const jornada = await this.prisma.jornada.findUnique({ where: { id } });
    if (jornada?.deleted_at !== null)
      throw new NotFoundException('La jornada no existe o ya está eliminada.');

    //No permitir desactivar la jornada si hay empleados activos asociados a ella
    const empleadosUsando = await this.prisma.empleados.count({where: { jornada_id: id, activo: true, deleted_at: null }});

    if (empleadosUsando > 0)throw new BadRequestException({
      title: 'Eliminación Bloqueada',
      detail: `Hay ${empleadosUsando} empleado(s) usando este turno. Reasígnalos primero.`
    });

    //Desactivar la jornada laboral
    return await this.prisma.jornada.update({
      where: { id },
      data: { activo: false, deleted_at: new Date() },
    });
  }

  /**
   * Reactiva una jornada laboral previamente desactivada en el sistema.
   * @param id - El ID de la jornada laboral a reactivar.
   * @returns La jornada laboral reactivada con sus detalles.
   * @throws {NotFoundException} Si la jornada laboral no existe.
   * @throws {InternalServerErrorException} Si ocurre un error inesperado al reactivar la jornada laboral.
   */
  async reactivar(id: string) {
    try {
      //Verificar si la jornada laboral existe
      const jornada = await this.prisma.jornada.findUnique({ where: { id } });

      if (!jornada) throw new NotFoundException({
        title: 'Jornada no encontrada',
        detail: 'La jornada especificada no existe.'
      });
      
      //Reactivar la jornada laboral
      return await this.prisma.jornada.update({
        where: { id },
        data: { activo: true, deleted_at: null }
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException({
        title: 'Error al reactivar jornada',
        detail: error instanceof Error ? error.message : 'Fallo inesperado al reactivar la jornada.',
      });
    }
  }
}