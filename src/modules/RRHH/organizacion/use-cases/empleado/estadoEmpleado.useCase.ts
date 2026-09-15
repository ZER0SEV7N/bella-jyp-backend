//src/modules/RRHH/use-cases/empleado/estadoEmpleado.UseCase.ts
import { BadRequestException, Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Caso de uso para gestionar el estado de un empleado, incluyendo la baja laboral (soft delete) y la reactivación del legajo.
 * Este caso de uso encapsula la lógica de negocio relacionada con el estado del empleado, asegurando que las operaciones se realicen de manera consistente y segura.
 */
@Injectable()
export class EstadoEmpleadoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Desactiva (da de baja) un legajo de empleado, marcando el registro como inactivo y estableciendo la fecha de cese.
   * Si el empleado no existe o ya está dado de baja, se lanza una excepción.
   * @param id - ID del empleado a desactivar.
   * @returns - El empleado desactivado con sus datos actualizados, incluyendo área y cargo.
   * @throws NotFoundException - Si el empleado no existe o ya está dado de baja.
   * @throws InternalServerErrorException - Si ocurre un error inesperado durante la operación.
   */
  async desactivar(id: string) {
    try {
      const empleado = await this.prisma.empleados.findUnique({where: { id, deleted_at: null }});

      if (!empleado) throw new NotFoundException({
        title: 'Colaborador no encontrado',
        detail: 'El legajo no existe o ya se encuentra dado de baja.'
      });
      
      return await this.prisma.empleados.update({
        where: { id },
        data: {
          activo: false,
          fecha_cese: new Date(),
          deleted_at: new Date()
        },
        include: {
          area: { select: { id: true, nombre: true } },
          cargo: { select: { id: true, nombre: true } }
        }
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException({
        title: 'Error al dar de baja al colaborador',
        detail: error instanceof Error ? error.message : 'Fallo inesperado al procesar el cese del empleado.'
      });
    }
  }

  /**
   * Reactiva un legajo de empleado previamente dado de baja, restaurando su estado a activo y eliminando la fecha de cese.
   * Si el empleado no existe o ya está activo, se lanza una excepción.
   * @param id - ID del empleado a reactivar.
   * @returns - Un objeto con el estado de la operación, un mensaje y los datos del empleado reactivado.
   * @throws NotFoundException - Si el empleado no existe.
   * @throws BadRequestException - Si el empleado ya está activo.
   */
  async reactivar(id: string) {
    try {
      const empleado = await this.prisma.empleados.findUnique({where: { id }});

      if (!empleado) throw new NotFoundException({
        title: 'Colaborador no encontrado',
        detail: 'El legajo especificado no existe en el sistema.'
      });
      
      if (empleado.activo && empleado.deleted_at === null) throw new BadRequestException({
        title: 'Colaborador ya activo',
        detail: `El colaborador con documento ${empleado.nro_documento} ya se encuentra activo.`,
      });

      const empleadoReactivado = await this.prisma.empleados.update({
        where: { id },
        data: {
          activo: true,
          fecha_cese: null,
          deleted_at: null
        },
        include: {
          area: { select: { id: true, nombre: true } },
          cargo: { select: { id: true, nombre: true } },
          estado_empleado: { select: { id: true, descripcion: true } }
        }
      });

      return {
        state: true,
        message: 'Colaborador reactivado correctamente. Verifique la asignación de contratos, jornada y régimen previsional.',
        data: empleadoReactivado
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;

      throw new InternalServerErrorException({
        title: 'Error al reactivar legajo',
        detail: error instanceof Error ? error.message : 'Fallo inesperado al restaurar el estado del colaborador.'
      });
    }
  }
}