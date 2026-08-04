//src/modules/RRHH/use-cases/area/crearArea.useCase.ts
//Caso de uso para crear un área en el módulo de RRHH
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CrearAreaDto } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';

@Injectable()
export class CrearAreaUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(dto: CrearAreaDto) {
    try {
      //Generar un nuevo ID para el área utilizando la utilidad IdentityGenerator
      const newAreaId = IdentityGenerator.generateId();

      //Crear el área en la base de datos utilizando Prisma
      const area = await this.prisma.area.create({
        data: {
          id: newAreaId,
          nombre: dto.nombre,
          descripcion: dto.descripcion,
          activo: true,
        },
      });
      //Retornar el área creada
      return area;
    } catch (error) {
      throw new InternalServerErrorException(
        'Ocurrió un error al intentar crear el área',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
