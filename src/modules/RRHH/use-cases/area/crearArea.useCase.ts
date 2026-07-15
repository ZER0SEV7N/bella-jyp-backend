import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import { dtoCrearAreaInput, crearAreaSchema } from '@jyp/shared-contracts';
@Injectable()
export class CrearAreaUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(dto: dtoCrearAreaInput) {
    // 1. Validar: Zod lanza error automáticamente si falla
    const dataValidada = crearAreaSchema.parse(dto);
    // 2. Crear y manejar errores
    try {
      const areaCreada = await this.prisma.area.create({
        data: {
          id: crypto.randomUUID(),
          ...dataValidada,
        },
      });
      // 3. Retorno exitoso
      return {
        state: true,
        message: 'Area creada correctamente',
        data: areaCreada,
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
