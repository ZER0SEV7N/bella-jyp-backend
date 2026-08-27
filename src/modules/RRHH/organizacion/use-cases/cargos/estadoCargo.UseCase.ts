//src/modules/RRHH/use-cases/cargos/estadoCargo.UseCase.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Clase que representa el caso de uso para cambiar el estado de un cargo en el módulo de RRHH.
 * Permite a los usuarios con los roles adecuados (ADMIN, RRHH) desactivar o reactivar un cargo proporcionando su ID.
 */
@Injectable()
export class EstadoCargoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Desactiva un cargo existente en el sistema.
   * @param id - El ID del cargo a desactivar.
   * @returns El cargo desactivado con sus detalles.
   * @throws {NotFoundException} Si el cargo no existe o ya está eliminado.
   * @throws {BadRequestException} Si hay empleados activos asociados al cargo.
   * @throws {InternalServerErrorException} Si ocurre un error inesperado al desactivar el cargo.
   */
  async desactivar(id: string) {
    try {
      const cargo = await this.prisma.cargo.findUnique({ where: { id } });

      if (cargo?.deleted_at !== null) throw new NotFoundException({
        title: 'Cargo no encontrado',
        detail: 'El cargo especificado no existe o ya se encuentra eliminado.',
      });
    
      const empleadosAsignados = await this.prisma.empleados.count({where: {
          cargo_id: id,
          activo: true,
          deleted_at: null
        }});

      if (empleadosAsignados > 0) throw new BadRequestException({
        title: 'Eliminación bloqueada',
        detail: `Este cargo está siendo ocupado por ${empleadosAsignados} empleado(s) activo(s). Debe reasignarlos antes de desactivar el cargo.`,
      });
      

      return await this.prisma.cargo.update({
        where: { id },
        data: {activo: false, deleted_at: new Date() }
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      
      throw new InternalServerErrorException({
        title: 'Error al desactivar el cargo',
        detail: error instanceof Error ? error.message : 'Fallo inesperado al desactivar el cargo.',
      });
    }
  }

  /**
   * Reactiva un cargo previamente desactivado en el sistema.
   * @param id - El ID del cargo a reactivar.
   * @returns El cargo reactivado con sus detalles.
   * @throws {NotFoundException} Si el cargo no existe.
   * @throws {InternalServerErrorException} Si ocurre un error inesperado al reactivar el cargo.
   */
  async reactivar(id: string) {
    try {
      const cargo = await this.prisma.cargo.findUnique({ where: { id } });

      if (!cargo) throw new NotFoundException({
        title: 'Cargo no encontrado',
        detail: 'El cargo especificado no existe.',
      });
    

      return await this.prisma.cargo.update({
        where: { id },
        data: { activo: true, deleted_at: null },
        include: {
          area: { select: { id: true, nombre: true } },
          jornada_sugerida: { select: { id: true, nombre: true, tipo_jornada: true } }
        }
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException({
        title: 'Error al reactivar el cargo',
        detail: error instanceof Error ? error.message : 'Fallo inesperado al restaurar el cargo.',
      });
    }
  }
}