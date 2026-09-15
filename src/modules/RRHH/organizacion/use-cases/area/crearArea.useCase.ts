//src/modules/RRHH/organizacion/use-cases/area/crearArea.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CrearAreaDto } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { sanitizarTexto } from '@/common/utils/transformacion.util';
import { verificarNombreAreaUnico } from '@/modules/RRHH/common/verificacciones-rrhh.helper';

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
      //Verificar que no exista un área con el mismo nombre antes de crearla
      await verificarNombreAreaUnico(this.prisma, dto.nombre);

      //Crear el área en la base de datos utilizando Prisma
      return await this.prisma.area.create({
        data: {
          id: IdentityGenerator.generateId(),
          nombre: sanitizarTexto(dto.nombre),
          descripcion: sanitizarTexto(dto.descripcion),
          activo: true
        }
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      throw new InternalServerErrorException({
        title: 'Error al Registrar Área',
        detail: error instanceof Error ? error.message : 'Fallo interno al registrar la nueva área.'
      });
    }
  }
}