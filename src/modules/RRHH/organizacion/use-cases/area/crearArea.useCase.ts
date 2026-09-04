//src/modules/RRHH/organizacion/use-cases/area/crearArea.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import {BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CrearAreaDto } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';

/**
 * Clase que representa el caso de uso para crear un área en el módulo de RRHH.
 * Permite a los usuarios con los roles adecuados (ADMIN, RRHH) 
 * registrar un nuevo área en el sistema, asegurando que no exista un área con el mismo nombre.
 * Se encarga de validar la existencia previa del área y de manejar errores durante la creación.
 */
@Injectable()
export class CrearAreaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para crear un área.
   * @param dto - Los datos necesarios para crear un área, incluyendo nombre y descripción.
   * @returns El área recién creada si la operación es exitosa.
   * @throws BadRequestException si ya existe un área con el mismo nombre.
   * @throws InternalServerErrorException si ocurre un error inesperado durante la creación.
   */
  async execute(dto: CrearAreaDto) {
    try {
      //Verificar si ya existe un área con el mismo nombre (insensible a mayúsculas/minúsculas)
      const areaExistente = await this.prisma.area.findFirst({
        where: {
          nombre: { equals: dto.nombre.trim(), mode: 'insensitive' },
          deleted_at: null
        }
      });

      //Si se encuentra un área existente, lanzar una excepción de solicitud incorrecta
      if (areaExistente) throw new BadRequestException({
        title: 'Área Duplicada',
        detail: `Ya existe un área registrada con el nombre '${dto.nombre.trim()}'.`
      });

      //Crear el área en la base de datos utilizando Prisma
      return await this.prisma.area.create({
        data: {
          id: IdentityGenerator.generateId(),
          nombre: dto.nombre.trim(),
          descripcion: dto.descripcion?.trim() || null,
          activo: true
        }
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      throw new InternalServerErrorException( 'Ocurrió un error al intentar registrar la nueva área.', error instanceof Error ? error.message : undefined);
    }
  }
}
