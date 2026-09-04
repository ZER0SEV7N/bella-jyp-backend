//src/modules/RRHH/use-cases/cargos/estadoCargo.UseCase.ts
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

  async desactivar(id: string) {
    try {
      await obtenerCargo(this.prisma, id);

      const empleadosAsignados = await this.prisma.empleados.count({
        where: {
          cargo_id: id,
          activo: true,
          deleted_at: null,
        },
      });

      if (empleadosAsignados > 0) {
        throw new BadRequestException({
          title: 'Eliminación bloqueada',
          detail: `Este cargo está siendo ocupado por ${empleadosAsignados} empleado(s) activo(s). Debe reasignarlos antes de desactivar el cargo.`,
        });
      }

      return await this.prisma.cargo.update({
        where: { id },
        data: { activo: false, deleted_at: new Date() },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException({
        title: 'Error al desactivar el cargo',
        detail: error instanceof Error ? error.message : 'Fallo inesperado al desactivar el cargo.',
      });
    }
  }

  async reactivar(id: string) {
    try {
      const cargo = await this.prisma.cargo.findUnique({ where: { id } });

      if (!cargo) {
        throw new NotFoundException({
          title: 'Cargo no encontrado',
          detail: 'El cargo especificado no existe.',
        });
      }

      // Regla de Negocio 1: El cargo ya debe estar inactivo
      if (cargo.activo && cargo.deleted_at === null) {
        throw new BadRequestException({
          title: 'Cargo ya activo',
          detail: `El cargo '${cargo.nombre}' ya se encuentra activo.`,
        });
      }

      // Regla de Negocio 2: El área matriz debe existir y estar activa
      const area = await this.prisma.area.findUnique({
        where: { id: cargo.id_area, deleted_at: null },
      });

      if (!area || !area.activo) {
        throw new BadRequestException({
          title: 'Área inactiva',
          detail: 'No se puede reactivar el cargo porque el área a la que pertenece está inactiva o eliminada.',
        });
      }

      return await this.prisma.cargo.update({
        where: { id },
        data: { activo: true, deleted_at: null },
        include: { area: { select: { id: true, nombre: true } } },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException({
        title: 'Error al reactivar el cargo',
        detail: error instanceof Error ? error.message : 'Fallo inesperado al restaurar el cargo.',
      });
    }
  }
}