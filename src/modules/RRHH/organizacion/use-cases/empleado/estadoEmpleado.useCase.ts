//src/modules/RRHH/use-cases/empleado/estadoEmpleado.UseCase.ts
import { BadRequestException, Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { DesactivarEmpleadoDto, CambiarEstadoLaboralDto } from '@jyp/shared-contracts';
import { estado_empleado_enum } from '@prisma/client';

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
  async desactivar(id: string, dto?: DesactivarEmpleadoDto) {
    try {
      //Buscar el empleado por ID, asegurándose de que no esté ya dado de baja
      const empleado = await this.prisma.empleados.findUnique({where: { id, deleted_at: null }});

      if (!empleado) throw new NotFoundException({
        title: 'Colaborador no encontrado',
        detail: 'El legajo no existe o ya se encuentra dado de baja.'
      });
      
      //Actualizar el estado del empleado a inactivo, estableciendo la fecha de cese y marcando el registro como eliminado (soft delete)
      const fechaCese = dto?.fecha_cese ? new Date(dto.fecha_cese) : new Date();

      return await this.prisma.empleados.update({
        where: { id },
        data: {
          activo: false,
          estado_laboral: estado_empleado_enum.CESADO,
          fecha_cese: fechaCese,
          deleted_at: new Date(),
        },
        include: {
          area: { select: { id: true, nombre: true } },
          cargo: { select: { id: true, nombre: true } },
        },
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
      //Buscar el empleado por ID, asegurándose de que exista
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
          cargo: { select: { id: true, nombre: true } }
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

  /**
   * Cambiar el estado laboral de un empleado mientras sigue activo en la empresa.
   * Verifica que el empleado exista y esté activo antes de realizar el cambio.
   * Si el estado laboral es el mismo que el actual, se lanza una excepción.
   * @param id - ID del empleado cuyo estado laboral se desea cambiar.
   * @param dto - Objeto que contiene el nuevo estado laboral y un motivo opcional para el cambio.
   * @returns 
   */
  async cambiarEstadoLaboral(id: string, dto: CambiarEstadoLaboralDto) {
    try {
      const empleado = await this.prisma.empleados.findUnique({where: { id, deleted_at: null } });

      if (!empleado || !empleado.activo) throw new NotFoundException({
        title: 'Colaborador no disponible',
        detail: 'No se puede modificar la situación operativa de un colaborador inactivo o cesado. Debe reactivarlo primero.',
      });
      

      if (empleado.estado_laboral === dto.estado_laboral) throw new BadRequestException({
        title: 'Estado sin cambios',
        detail: `El colaborador ya se encuentra en estado '${dto.estado_laboral}'.`,
      });

      const empleadoActualizado = await this.prisma.empleados.update({
        where: { id },
        data: { estado_laboral: dto.estado_laboral as estado_empleado_enum },
        include: {
          area: { select: { id: true, nombre: true } },
          cargo: { select: { id: true, nombre: true } },
        },
      });

      return {
        state: true,
        message: `Estado laboral actualizado a ${dto.estado_laboral} exitosamente.`,
        data: empleadoActualizado
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;

      throw new InternalServerErrorException({
        title: 'Error al cambiar estado laboral',
        detail: error instanceof Error ? error.message : 'Fallo inesperado al cambiar el estado operativo.',
      });
    }
  }
}