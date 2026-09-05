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
    try {
      //Verificar si la jornada laboral existe y no está eliminada
      const jornada = await this.prisma.jornada.findUnique({
        where: { id, deleted_at: null },
        include: {_count: { select: { empleados: {where: { activo: true, deleted_at: null } } } } }
      });

      //Si no existe, lanzar excepción
      if (!jornada) throw new NotFoundException({
        title: 'Jornada no encontrada',
        detail: 'La jornada que intenta desactivar no existe o ya fue dada de baja.',
      });

      //Regla de negocio: No desactivar si hay colaboradores activos con este turno
      if (jornada._count.empleados > 0) throw new BadRequestException({
        title: 'Jornada en Uso',
        detail: `No se puede desactivar la jornada '${jornada.nombre}' 
                porque actualmente está asignada a ${jornada._count.empleados} empleado(s) activo(s). 
                Reasigne a los colaboradores antes de proceder.`
      });
      
      //Desactivar la jornada laboral
      return await this.prisma.jornada.update({
        where: { id },
        data: { activo: false, deleted_at: new Date() }
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) 
        throw error;
      
      throw new InternalServerErrorException('Error al intentar desactivar la jornada.');
    }
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
      const jornada = await this.prisma.jornada.findUnique({where: { id }});

      //Si no existe, lanzar excepción
      if (!jornada) throw new NotFoundException({
        title: 'Jornada no encontrada',
        detail: 'La jornada especificada no existe en los registros.'
      });
      
      //Regla de negocio: No reactivar si ya está activa
      if (jornada.activo && jornada.deleted_at === null) throw new BadRequestException({
        title: 'Jornada ya activa',
        detail: `La jornada '${jornada.nombre}' ya se encuentra activa en el sistema.`
      });
      

      //Reactivar la jornada laboral
      return await this.prisma.jornada.update({
        where: { id },
        data: {activo: true, deleted_at: null }
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) 
        throw error;
      
      throw new InternalServerErrorException('Error al reactivar la jornada.');
    }
  }
}