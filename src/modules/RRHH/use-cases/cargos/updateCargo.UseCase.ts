import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import { editCargoSchema, dtoEditCargoInput } from '@jyp/shared-scontracts';
@Injectable()
export class UpdateCargoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(id: string, dto: dtoEditCargoInput) {
    //validar con zod
    const Cargo = editCargoSchema.parse(dto);
    try {
      await this.prisma.cargo.update({
        where: { id: id },
        data: Cargo,
      });
      return {
        state: true,
        message: 'Cargo actulizdo correctamente',
        data: Cargo,
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
