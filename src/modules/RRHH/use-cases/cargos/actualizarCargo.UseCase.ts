//src/modules/RRHH/use-cases/cargos/actualizarCargo.UseCase.ts
//Caso de uso para actualizar un cargo en el módulo de RRHH
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActualizarCargoDto } from '@jyp/shared-contracts';

/**
 * Clase que representa el caso de uso para actualizar un cargo en el módulo de RRHH.
 * Se encarga de validar la existencia del cargo, verificar que el área destino exista y esté activa antes de proceder con la actualización.
 * Maneja excepciones para casos de cargo no encontrado, área destino inválida y errores internos durante la actualización.
 */
@Injectable()
export class ActualizarCargoUseCase {
  //Inyectar el servicio de Prisma para interactuar con la base de datos
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string, payload: ActualizarCargoDto) {
    try {
      const cargoActual = await this.prisma.cargo.findUnique({ where: { id } });

      if (!cargoActual || cargoActual.deleted_at !== null)
        throw new NotFoundException({
          title: 'Cargo no encontrado',
          detail:
            'El cargo que intenta actualizar no existe o ha sido eliminado.',
        });

      //Si el payload incluye un id_area nuevo, verificar que el area destino exista y esté activa antes de proceder con la actualización
      if (payload.id_area && payload.id_area !== cargoActual.id_area) {
        const areaDestino = await this.prisma.area.findUnique({
          where: { id: payload.id_area },
        });

        if (!areaDestino || !areaDestino.activo)
          throw new BadRequestException({
            title: 'Área destino inválida',
            detail:
              'El área a la que intenta mover el cargo no existe o está inactiva.',
          });
      }

      //Actualizar el cargo con los nuevos datos proporcionados en el payload
      const cargoActualizado = await this.prisma.cargo.update({
        where: { id },
        data: { ...payload },
      });

      return cargoActualizado;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;

      throw new BadRequestException({
        title: 'Error de Actualización',
        detail: 'No se pudo actualizar el registro del cargo.',
      });
    }
  }
}
