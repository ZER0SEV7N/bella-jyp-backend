//src/modules/RRHH/organizacion/use-cases/cargos/activeCargo.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import { z } from 'zod';

/**
 * Caso de uso para reactivar un cargo que se encuentra desactivado
 * Este caso de uso permite restaurar un cargo previamente eliminado (Soft Delete)
 * y marcarlo como activo nuevamente en el sistema.
 */
@Injectable()
export class ActiveCargoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para reactivar un cargo.
   * @param idCargo - El ID del cargo a reactivar.
   * @returns Una promesa que resuelve con los datos del cargo reactivado.
   */
  async execute(idCargo: string) {
    const idValidado = z.string().parse(idCargo);

    try {
      const data = await this.prisma.cargo.update({
        where: { id: idValidado },
        data: {
          activo: true,
          deleted_at: null //Limpiar la fecha de eliminación para restaurar el cargo
        }
      });

      return {
        state: true,
        message: 'Cargo restaurado/activado correctamente',
        data: data
      };
    } catch (error) {
      throw new BadRequestException({
        title: 'Error al activar el cargo',
        detail:'No se pudo realizar la operación, asegúrate de que el ID sea correcto.',
      });
    }
  }
}
