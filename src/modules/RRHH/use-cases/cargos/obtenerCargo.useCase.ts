import { PrismaService } from '@/common/prisma/prisma.service';
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

//Caso de uso para eliminar un área (Soft Delete) en el módulo de RRHH
@Injectable()
export class ObtenerCargoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(id: string) {
    try {
      //obtener Area
      const CargoValido = await this.prisma.cargo.findUnique({
        where: {
          id: id,
        },
        omit: {
          activo: true,
        },
      });
      //validar
      if (!CargoValido || CargoValido.deleted_at !== null) {
        throw new NotFoundException(
          `El cargo con ID ${id} no existe o ya fue eliminada`,
        );
      }
      return CargoValido;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error al obtener el cargo');
    }
  }
}
