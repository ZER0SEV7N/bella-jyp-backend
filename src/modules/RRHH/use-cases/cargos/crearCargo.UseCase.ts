import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import { dtoCreateCargoInput, createCargoSchema } from '@jyp/shared-contracts';
@Injectable()
export class CrearCargoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(dto: dtoCreateCargoInput) {
    //validar con zod
    const data = createCargoSchema.parse(dto);
    try {
      const cargoCreado = await this.prisma.cargo.create({
        data: {
          id: crypto.randomUUID(),
          ...data,
        },
      });
      return {
        state: true,
        message: 'Cargo creada correctamente',
        data: cargoCreado,
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
