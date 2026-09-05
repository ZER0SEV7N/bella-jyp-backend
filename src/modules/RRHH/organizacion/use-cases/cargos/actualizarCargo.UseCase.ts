//src/modules/RRHH/organizacion/use-cases/cargos/actualizarCargo.UseCase.ts
//Caso de uso para actualizar un cargo en el módulo de RRHH
import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActualizarCargoDto } from '@jyp/shared-contracts';
import { obtenerCargo, validarAreaActiva, validarNombreUnico, validarBandaSalarial, resolverSueldo } from './helpers/validaciones.helper';

/**
 * Clase que representa el caso de uso para actualizar un cargo en el módulo de RRHH.
 * Se encarga de validar la existencia del cargo, verificar que el área destino exista y esté activa antes de proceder con la actualización.
 * Maneja excepciones para casos de cargo no encontrado, área destino inválida y errores internos durante la actualización.
 */
@Injectable()
export class ActualizarCargoUseCase {
  //Inyectar el servicio de Prisma para interactuar con la base de datos
  constructor(private readonly prisma: PrismaService) {}

   /**
   * Ejecuta el caso de uso para actualizar un cargo.
   * @param id - El ID del cargo a actualizar.
   * @param payload - Los datos a actualizar del cargo.
   * @returns Una promesa que resuelve con el cargo actualizado.
   */
  async execute(id: string, payload: ActualizarCargoDto) {
    try {

      //Obtener el cargo actual para validar su existencia y obtener sus datos actuales
      const cargoActual = await obtenerCargo(this.prisma,id);

      //Determinar el área destino y el nombre objetivo para la validación
      const idAreaTarget = payload.id_area ?? cargoActual.id_area;
      
      //Determinar el nombre objetivo para la validación de colisión de nombres
      const targetName = payload.nombre ? payload.nombre.trim() : cargoActual.nombre;

      //Validar que el área destino exista y esté activa, y que no haya colisión de nombres en esa área
      await validarAreaActiva(this.prisma, payload.id_area, cargoActual.id_area);
      await validarNombreUnico(this.prisma, id, targetName, idAreaTarget);

      //Validar la banda salarial antes de actualizar el cargo
      validarBandaSalarial(
        resolverSueldo(payload.sueldo_minimo, cargoActual.sueldo_minimo),
        resolverSueldo(payload.sueldo_maximo, cargoActual.sueldo_maximo),
      );

      //Actualizar el cargo en la base de datos utilizando Prisma
      return await this.prisma.cargo.update({
        where: { id },
        data: {
          id_area: payload.id_area ?? undefined,
          nombre: payload.nombre ? payload.nombre.trim() : undefined,
          descripcion: payload.descripcion !== undefined ? (payload.descripcion?.trim() || null) : undefined,
          sueldo_minimo: payload.sueldo_minimo !== undefined ? payload.sueldo_minimo : undefined,
          sueldo_maximo: payload.sueldo_maximo !== undefined ? payload.sueldo_maximo : undefined
        },
        include: {area: { select: { id: true, nombre: true } } }
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) 
        throw error;
      
      throw new InternalServerErrorException({
        title: 'Error de Actualización',
        detail: error instanceof Error ? error.message : 'No se pudo actualizar el registro del cargo.'
      });
    }
  }
}