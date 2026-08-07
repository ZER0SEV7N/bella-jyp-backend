//src/modules/RRHH/use-cases/area/crearArea.useCase.ts
//Caso de uso para crear un área en el módulo de RRHH
import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CrearAreaDto } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';

@Injectable()
export class CrearAreaUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(dto: CrearAreaDto) {
    //Validación de entrada: Aseguramos que el DTO no sea nulo y que contenga un nombre válido
    if (!dto || !dto.nombre) throw new BadRequestException('El nombre del área es estrictamente obligatorio.');
    
    try {
      //Verificamos si ya existe un área con el mismo nombre para evitar duplicados
      const areaExistente = await this.prisma.area.findFirst({
        where: { nombre: dto.nombre },
      });

      if (areaExistente) throw new BadRequestException(`Ya existe un área registrada con el nombre '${dto.nombre}'.`);
      
      //Generar un nuevo ID para el área utilizando la utilidad IdentityGenerator
      const newAreaId = IdentityGenerator.generateId();

      //Crear el área en la base de datos utilizando Prisma
      const area = await this.prisma.area.create({
        data: {
          id: newAreaId,
          nombre: dto.nombre,
          descripcion: dto.descripcion,
          activo: true
        }
      });
      //Retornar el área creada
      return area;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      
      throw new InternalServerErrorException('Ocurrió un error al intentar crear el área',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
