//src/modules/RRHH/organizacion/use-cases/cargos/estadoCargo.useCase.ts
import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
<<<<<<< HEAD:src/modules/RRHH/organizacion/use-cases/cargos/estadoCargo.UseCase.ts
import { obtenerCargo, verificarNombreUnicoCargoActivo } from './helpers/validaciones.helper';
=======
import {
  obtenerCargo,
  verificarNombreUnicoCargoActivo,
} from './helpers/validaciones.helper';
>>>>>>> 5e75acc6bdee88d8bc621e30c26b02176fbd6c5f:src/modules/RRHH/organizacion/use-cases/cargos/estadoCargo.useCase.ts
import { verificarAreaActiva } from '@/modules/RRHH/common/verificacciones-rrhh.helper';

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

      const empleadosAsignados = await this.prisma.empleados.count({
        where: {
          cargo_id: id,
          activo: true,
          deleted_at: null,
        },
      });

      if (empleadosAsignados > 0)
        throw new BadRequestException({
          title: 'Eliminación bloqueada',
          detail: `Este cargo está siendo ocupado por ${empleadosAsignados} empleado(s) activo(s). Debe reasignarlos antes de desactivar el cargo.`,
        });

      return await this.prisma.cargo.update({
        where: { id },
        data: { activo: false, deleted_at: new Date() },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException({
        title: 'Error al desactivar el cargo',
        detail:
          error instanceof Error
            ? error.message
            : 'Fallo inesperado al desactivar el cargo.',
      });
    }
  }

  /**
   * Metodo para reactivar un cargo. Verifica que el cargo exista y que esté desactivado (COM-F3).
   * Además, comprueba que el área a la que pertenece el cargo esté activa antes de reactivarlo.
   * @param id - El ID del cargo a reactivar.
   * @returns Una promesa que resuelve con el cargo reactivado.
   * @throws {NotFoundException} Si el cargo no existe o su área está inactiva.
   * @throws {BadRequestException} Si el cargo ya está activo.
   * @throws {ConflictException} Si ya existe otro cargo activo con el mismo nombre.
   * @throws {InternalServerErrorException} Para errores inesperados durante la reactivación.
   */
  async reactivar(id: string) {
    try {
      const cargo = await this.prisma.cargo.findUnique({ where: { id } });

      if (!cargo)
        throw new NotFoundException({
          title: 'Cargo no encontrado',
          detail: 'El cargo especificado no existe.',
        });

      if (cargo.activo && cargo.deleted_at === null)
        throw new BadRequestException({
          title: 'Cargo ya activo',
          detail: `El cargo '${cargo.nombre}' ya se encuentra activo.`,
        });

      await verificarAreaActiva(this.prisma, cargo.id_area);
      await verificarNombreUnicoCargoActivo(
        this.prisma,
        cargo.nombre,
        cargo.id
      );
      return await this.prisma.cargo.update({
        where: { id },
        data: { activo: true, deleted_at: null },
        include: { area: { select: { id: true, nombre: true } } },
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException({
        title: 'Error al reactivar el cargo',
        detail:
          error instanceof Error
            ? error.message
            : 'Fallo inesperado al restaurar el cargo.',
      });
    }
  }
}
