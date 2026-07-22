import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class ActiveAreaUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(idArea: string) {
    //validara
    const idValidado = z.uuid().parse(idArea);
    try {
      //ejecutar con prisma
      const data = await this.prisma.area.update({
        where: {
          id: idValidado,
        },
        data: {
          activo: true,
        },
      });
      return {
        state: true,
        message: 'Área eliminada correctamente',
        data: data,
      };
    } catch (error) {
      // 3. Manejo de error para evitar que el sistema falle silenciosamente
      throw new BadRequestException({
        title: 'Error al activar el área',
        detail:
          'No se pudo realizar la operación, asegúrate de que el ID sea correcto.',
      });
    }
  }
}
