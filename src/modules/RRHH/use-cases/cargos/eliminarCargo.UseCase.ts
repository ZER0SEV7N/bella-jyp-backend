import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import { eliminarCargoSchema } from '@jyp/shared-contracts';
@Injectable()
export class EliminarCargoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(idCargo: string) {
    //validar con zod
    const { id } = eliminarCargoSchema.parse({ id: idCargo });
    try {
      const CargoEliminado = await this.prisma.cargo.update({
        where: { id: id },
        data: {
          activo: false,
          deleted_at: new Date(),
        },
      });
      return {
        state: true,
        message: 'Cargo inhabilitado correctamente',
        data: CargoEliminado,
      };
    } catch (error) {
      throw new BadRequestException({
        type: 'https://api.jyp.com/errors/bad-request',
        title: 'Error al crear el área',
        detail:
          'No se pudo guardar en la base de datos. Verifica que el nombre no esté duplicado.',
      });
    }
  }
}
