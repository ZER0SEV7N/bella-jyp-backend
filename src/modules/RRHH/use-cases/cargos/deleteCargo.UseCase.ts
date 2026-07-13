import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import {
  dtoEliminarCargoInput,
  eliminarCargoSchema,
} from '@jyp/shared-contracts';
@Injectable()
export class DeleteCargoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(dto: dtoEliminarCargoInput) {
    //validar con zod
    const data = eliminarCargoSchema.parse(dto);
    try {
      const CargoEliminado = await this.prisma.cargo.update({
        where: { id: data.id },
        data: {
          activo: false,
          deleted_at: new Date(),
        },
      });
      return {
        state: true,
        message: 'Cargo inhabilitada correctamente',
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
