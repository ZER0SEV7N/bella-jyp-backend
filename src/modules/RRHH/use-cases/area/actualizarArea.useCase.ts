//src/modules/RRHH/use-cases/area/ActualizarArea.useCase.ts
//Caso de uso para actualizar un área en el módulo de RRHH
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ActualizarAreaDto } from '@jyp/shared-contracts';

@Injectable()
export class ActualizarAreaUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(areaId: string, dto: ActualizarAreaDto) {
     try {
      //Verificar si el área existe y no está eliminada
      const existingArea = await this.prisma.area.findUnique({ where: { id: areaId }, });

      if (!existingArea || existingArea.deleted_at !== null) throw new NotFoundException(`El área con ID ${areaId} no fue encontrada o está eliminada`);

      //Ejecutar la actualización
      const updatedArea = await this.prisma.area.update({
        where: { id: areaId },
        data: {
          nombre: dto.nombre,
          descripcion: dto.descripcion,
        },
      });

      return updatedArea;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error al intentar actualizar el área');
    }
  }
}
