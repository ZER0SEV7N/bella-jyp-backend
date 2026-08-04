import { PrismaService } from '@/common/prisma/prisma.service';
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

//Caso de uso para eliminar un área (Soft Delete) en el módulo de RRHH
@Injectable()
export class ObtenerAreaUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(id: string) {
    try {
      //obtener Area
      const AreaValida = await this.prisma.area.findUnique({
        where: {
          id: id,
        },
        omit: {
          activo: true,
        },
      });
      //validar
      if (!AreaValida || AreaValida.deleted_at !== null) {
        throw new NotFoundException(
          `El área con ID ${id} no existe o ya fue eliminada`,
        );
      }
      return AreaValida;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error al obtener el área');
    }
  }
}
