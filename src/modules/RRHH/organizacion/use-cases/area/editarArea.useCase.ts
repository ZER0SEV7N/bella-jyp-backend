//src/modules/RRHH/organizacion/use-cases/area/editarArea.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException} from '@nestjs/common';
import { ActualizarAreaDto } from '@jyp/shared-contracts';
import { sanitizarTexto } from '@/common/utils/transformacion.util';
import { verificarNombreAreaUnico } from '@/modules/RRHH/common/verificacciones-rrhh.helper';

/**
 * Clase que representa el caso de uso para actualizar un área en el módulo de RRHH.
 * Permite a los usuarios con los roles adecuados (ADMIN, RRHH) 
 * modificar la información de un área existente en el sistema, asegurando que no exista un área con el mismo nombre.
 * Se encarga de validar la existencia del área y de manejar errores durante la actualización.
 */
@Injectable()
export class EditarAreaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para actualizar un área.
   * @param areaId - El ID del área que se desea actualizar.
   * @param dto - Los datos necesarios para actualizar el área, incluyendo nombre y descripción.
   * @returns El área actualizada si la operación es exitosa.
   * @throws NotFoundException si el área con el ID proporcionado no existe.
   * @throws BadRequestException si ya existe otra área con el mismo nombre.
   * @throws InternalServerErrorException si ocurre un error inesperado durante la actualización.
   */
  async execute(areaId: string, dto: ActualizarAreaDto) {
    try {
      //Verificar que el área con el ID proporcionado exista y no haya sido eliminada
      const areaExistente = await this.prisma.area.findUnique({ where: { id: areaId, deleted_at: null } });

      //Si el área no existe, lanzar una excepción de no encontrado
      if (!areaExistente) throw new NotFoundException({
        title: 'Área no encontrada',
        detail: `El área con ID '${areaId}' no existe o ha sido eliminada.`
      });
      

      //Validar colisión de nombre solo si cambió respecto al actual
      if (dto.nombre && dto.nombre.trim() !== areaExistente.nombre) await verificarNombreAreaUnico(this.prisma, dto.nombre, areaId);
      
      //Actualizar el área en la base de datos utilizando Prisma
      return await this.prisma.area.update({
        where: { id: areaId },
        data: {
          nombre: sanitizarTexto(dto.nombre),
          descripcion: sanitizarTexto(dto.descripcion)
        }
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) 
        throw error;
      
      throw new InternalServerErrorException({
        title: 'Error de Actualización',
        detail: error instanceof Error ? error.message : 'Fallo interno al actualizar la información del área.'
      });
    }
  }
}