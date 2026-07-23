//src/modules/RRHH/use-cases/area/eliminarArea.useCase.ts
//Caso de uso para eliminar un área (Soft Delete) en el módulo de RRHH
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';

//Caso de uso para eliminar un área (Soft Delete) en el módulo de RRHH
@Injectable()
export class EliminarAreaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(areaId: string) {
    try {
      //Validar existencia
      const area = await this.prisma.area.findUnique({ where: { id: areaId } });

      if (!area || area.deleted_at !== null) throw new NotFoundException(`El área con ID ${areaId} no existe o ya fue eliminada`);
      
      //En caso de tener cargos activos asociados, no permitir la eliminación
      const cargosActivos = await this.prisma.cargo.count({
        where: { 
          id_area: areaId, 
          deleted_at: null 
        }
      });

      if (cargosActivos > 0) throw new BadRequestException('No se puede eliminar el área porque contiene cargos activos asignados. Reasigne o desactive los cargos primero.');

      //Aplicar Soft Delete: Actualizar el área para marcarla como eliminada
      const areaEliminada = await this.prisma.area.update({
        where: { id: areaId },
        data: {
          activo: false,
          deleted_at: new Date(), 
        },
      });

      return areaEliminada;
    } catch (error) {
      //Respetamos las excepciones controladas para el filtro global
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      
      throw new InternalServerErrorException('Error al intentar eliminar (Soft Delete) el área');
    }
  }
}