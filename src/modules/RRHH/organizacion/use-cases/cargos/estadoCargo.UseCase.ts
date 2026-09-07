//src/modules/RRHH/use-cases/organizacion/cargos/estadoCargo.UseCase.ts
import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { obtenerCargo } from './helpers/validaciones.helper';

/**
 * Clase que representa el caso de uso para cambiar el estado de un cargo en el módulo de RRHH.
 * Permite a los usuarios con los roles adecuados (ADMIN, RRHH) desactivar o reactivar un cargo proporcionando su ID.
 */
@Injectable()
export class EstadoCargoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Metodo para desactivar un cargo. Antes de desactivarlo, verifica que el cargo exista y que no esté siendo ocupado por empleados activos.
   * Si el cargo está siendo ocupado, lanza una excepción BadRequestException con un mensaje detallado.
   * @param id - El ID del cargo a desactivar.
   * @returns Una promesa que resuelve con el cargo desactivado.
   * @throws NotFoundException si el cargo no existe.
   * @throws BadRequestException si el cargo está siendo ocupado por empleados activos.
   * @throws InternalServerErrorException para errores inesperados durante la desactivación.
   */
  async desactivar(id: string) {
    try {
      await obtenerCargo(this.prisma, id);

      //Verificar si hay empleados activos asignados a este cargo antes de desactivarlo
      const empleadosAsignados = await this.prisma.empleados.count({
        where: {
          cargo_id: id,
          activo: true,
          deleted_at: null
        }
      });

      if (empleadosAsignados > 0) throw new BadRequestException({
        title: 'Eliminación bloqueada',
        detail: `Este cargo está siendo ocupado por ${empleadosAsignados} empleado(s) activo(s). Debe reasignarlos antes de desactivar el cargo.`
      });
      
      //Retornar la actualización del cargo a inactivo y establecer la fecha de eliminación
      return await this.prisma.cargo.update({
        where: { id },
        data: { activo: false, deleted_at: new Date() }
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) 
        throw error;
      

      throw new InternalServerErrorException({
        title: 'Error al desactivar el cargo',
        detail: error instanceof Error ? error.message : 'Fallo inesperado al desactivar el cargo.'
      });
    }
  }

  /**
   * Metodo para reactivar un cargo. Verifica que el cargo exista y que esté desactivado.
   * Además, comprueba que el área a la que pertenece el cargo esté activa antes de reactivarlo.
   * @param id - El ID del cargo a reactivar.
   * @returns Una promesa que resuelve con el cargo reactivado.
   * @throws NotFoundException si el cargo no existe.
   * @throws BadRequestException si el cargo ya está activo o si el área a la que pertenece está inactiva.
   * @throws InternalServerErrorException para errores inesperados durante la reactivación.
   */
  async reactivar(id: string) {
    try {
      //Ubicar el cargo por su ID para validar su existencia y estado actual
      const cargo = await this.prisma.cargo.findUnique({ where: { id } });

      if (!cargo) throw new NotFoundException({
        title: 'Cargo no encontrado',
        detail: 'El cargo especificado no existe.'
      });
      

      //Verificar si realmente está desactivado antes de intentar reactivarlo
      if (cargo.activo && cargo.deleted_at === null) throw new BadRequestException({
        title: 'Cargo ya activo',
        detail: `El cargo '${cargo.nombre}' ya se encuentra activo.`
      });
      
      //Verificar que el área a la que pertenece el cargo esté activa antes de reactivarlo
      const area = await this.prisma.area.findUnique({
        where: { id: cargo.id_area, deleted_at: null },
      });

      if (!area || !area.activo) throw new BadRequestException({
        title: 'Área inactiva',
        detail: 'No se puede reactivar el cargo porque el área a la que pertenece está inactiva o eliminada.'
      });
      
      //Retornar la actualización del cargo a activo y limpiar la fecha de eliminación
      return await this.prisma.cargo.update({
        where: { id },
        data: { activo: true, deleted_at: null },
        include: { area: { select: { id: true, nombre: true } } }
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) 
        throw error;
      
      throw new InternalServerErrorException({
        title: 'Error al reactivar el cargo',
        detail: error instanceof Error ? error.message : 'Fallo inesperado al restaurar el cargo.'
      });
    }
  }
}