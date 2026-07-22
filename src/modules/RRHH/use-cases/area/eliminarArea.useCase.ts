import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import { eliminarAreaSchema } from '@jyp/shared-contracts';
@Injectable()
export class EliminarAreaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(idArea: string) {
    // 1. Validación
    const { id } = eliminarAreaSchema.parse({ id: idArea });

    try {
      // 2. Ejecución
      const areaEliminada = await this.prisma.area.update({
        where: { id: id },
        data: {
          activo: false,
          deleted_at: new Date(),
        },
      });

      return {
        state: true,
        message: 'Área eliminada correctamente',
        data: areaEliminada, // Retornar el objeto es buena práctica
      };
    } catch (error: unknown) {
      // 3. Manejo de error para evitar que el sistema falle silenciosamente
      throw new BadRequestException({
        title: 'Error al eliminar el área',
        detail:
          'No se pudo realizar la operación, asegúrate de que el ID sea correcto.',
      });
    }
  }
}
