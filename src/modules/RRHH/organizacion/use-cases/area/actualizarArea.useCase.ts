//src/modules/RRHH/organizacion/use-cases/area/ActualizarArea.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException} from '@nestjs/common';
import { ActualizarAreaDto } from '@jyp/shared-contracts';

/**
 * Clase que representa el caso de uso para actualizar un área en el módulo de RRHH.
 * Permite a los usuarios con los roles adecuados (ADMIN, RRHH) 
 * modificar la información de un área existente en el sistema, asegurando que no exista un área con el mismo nombre.
 * Se encarga de validar la existencia del área y de manejar errores durante la actualización.
 */
@Injectable()
export class ActualizarAreaUseCase {
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
      //Verificar si el área existe y no ha sido eliminada
      const areaExistente = await this.prisma.area.findUnique({where: { id: areaId, deleted_at: null }});

      //Si el área no existe, lanzar una excepción de no encontrado
      if (!areaExistente) throw new NotFoundException({
        title: 'Área no encontrada',
        detail: `El área con ID '${areaId}' no existe o ha sido eliminada.`,
      });
      

      //Validar colisión de nombres si se intenta modificar
      if (dto.nombre && dto.nombre.trim() !== areaExistente.nombre) {
        const nombreOcupado = await this.prisma.area.findFirst({
          where: {
            nombre: { equals: dto.nombre.trim(), mode: 'insensitive' },
            id: { not: areaId },
            deleted_at: null,
          },
        });

        //Si se encuentra un área con el mismo nombre, lanzar una excepción de solicitud incorrecta
        if (nombreOcupado) throw new BadRequestException({
          title: 'Nombre Duplicado',
          detail: `Ya existe otra área registrada con el nombre '${dto.nombre.trim()}'.`
        });
      }

      //Actualizar el área en la base de datos utilizando Prisma
      return await this.prisma.area.update({
        where: { id: areaId },
        data: {
          nombre: dto.nombre ? dto.nombre.trim() : undefined,
          descripcion: dto.descripcion !== undefined ? (dto.descripcion?.trim() || null) : undefined
        }
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) 
        throw error;
      
      throw new InternalServerErrorException( 'Error al intentar actualizar la información del área.', error instanceof Error ? error.message : undefined );
    }
  }
}