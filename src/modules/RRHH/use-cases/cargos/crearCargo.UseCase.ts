//src/modules/RRHH/use-cases/cargos/crearCargo.UseCase.ts
//Caso de uso para crear un cargo en el módulo de RRHH
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearCargoDto } from '@jyp/shared-contracts';

//Caso de uso
@Injectable()
export class CrearCargoUseCase {
  //Inyectar el servicio de Prisma para interactuar con la base de datos
  constructor(private readonly prisma: PrismaService) {}
  async execute(payload: CrearCargoDto) {
    try {
      //El area asignada debe existir y estar activa.
      const areaAsignada = await this.prisma.area.findUnique({ where: { id: payload.id_area } });

      if (!areaAsignada || !areaAsignada.activo || areaAsignada.deleted_at !== null) 
        throw new NotFoundException({
          title: 'Área inválida',
          detail: 'El área especificada no existe o se encuentra inactiva/eliminada.',
        });
      
      //Evitar que se creen dos cargos con el mismo nombre en la misma área
      const cargoExistente = await this.prisma.cargo.findFirst({
        where: { 
          nombre: payload.nombre,
          id_area: payload.id_area
        },
      });

      if (cargoExistente) 
        throw new BadRequestException({
          title: 'Cargo duplicado',
          detail: `Ya existe un cargo llamado '${payload.nombre}' dentro de esta área.`,
        });

      const nuevoId = IdentityGenerator.generateId();

      const nuevoCargo = await this.prisma.cargo.create({
        data: {
          id: nuevoId,
          id_area: payload.id_area,
          nombre: payload.nombre,
          descripcion: payload.descripcion,
          activo: true,
        },
      });

      return nuevoCargo;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      
      throw new BadRequestException({
        title: 'Error al crear el Cargo',
        detail: 'Fallo interno al intentar registrar el cargo en la base de datos.',
      });
    }
  }
}