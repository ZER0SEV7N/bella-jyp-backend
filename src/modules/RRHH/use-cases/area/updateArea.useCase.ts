import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import {
  dtoActualizarAreaInput,
  actualizarAreaSchema,
} from '@jyp/shared-scontracts';
@Injectable()
export class UpdateAreaUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(id: string, dto: dtoActualizarAreaInput) {
    //validar los datos de entrada del dto
    const dataValidada = actualizarAreaSchema.parse(dto);
    try {
      //actualizar el area en la base de datos
      const areaActualizada = await this.prisma.area.update({
        where: { id },
        data: dataValidada,
      });
      return {
        state: true,
        message: 'Área eliminada correctamente',
        data: areaActualizada,
      };
      //retornar el area actualizada
    } catch (error) {
      throw new BadRequestException({
        type: 'https://api.jyp.com/errors/bad-request',
        title: 'Error al actualizar el área',
        detail:
          'No se pudo actualizar en la base de datos. Verifica que el nombre no esté duplicado.',
      });
    }
  }
}
