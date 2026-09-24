//src/modules/RRHH/organizacion/use-cases/cargos/editarCargoUseCase.UseCase.ts
//Caso de uso para actualizar un cargo en el módulo de RRHH
import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActualizarCargoDto } from '@jyp/shared-contracts';
import { sanitizarTexto } from '@/common/utils/transformacion.util';
import { verificarAreaActiva } from '@/modules/RRHH/common/verificacciones-rrhh.helper';
import { obtenerCargo, validarNombreCargoUnico, validarBandaSalarial, resolverSueldo } from './helpers/validaciones.helper';

/**
 * Clase que representa el caso de uso para actualizar un cargo en el módulo de RRHH.
 * Se encarga de validar la existencia del cargo, verificar que el área destino exista y esté activa antes de proceder con la actualización.
 * Maneja excepciones para casos de cargo no encontrado, área destino inválida y errores internos durante la actualización.
 */
@Injectable()
export class EditarCargoUseCase {
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
      const cargoActual = await obtenerCargo(this.prisma, id);

      //Determinar el área y nombre destino para las validaciones, priorizando los valores del payload si están definidos
      const idAreaDestino = payload.id_area ?? cargoActual.id_area;
      const nombreDestino = payload.nombre ? payload.nombre.trim() : cargoActual.nombre;

      //Validar que el área destino exista y esté activa, y que el nombre del cargo sea único dentro de esa área
      await verificarAreaActiva(this.prisma, payload.id_area, cargoActual.id_area);
      await validarNombreCargoUnico(this.prisma, nombreDestino, idAreaDestino, id);

      //Resolver los valores de sueldo mínimo y máximo, utilizando los valores del payload si están definidos, o los valores actuales del cargo si no lo están
      const nuevoMinimo = resolverSueldo(payload.sueldo_minimo, cargoActual.sueldo_minimo);
      const nuevoMaximo = resolverSueldo(payload.sueldo_maximo, cargoActual.sueldo_maximo);
      validarBandaSalarial(nuevoMinimo, nuevoMaximo);

      //Actualizar el cargo en la base de datos utilizando Prisma
      return await this.prisma.cargo.update({
        where: { id },
        data: {
          id_area: payload.id_area,
          nombre: sanitizarTexto(payload.nombre),
          descripcion: sanitizarTexto(payload.descripcion),
          sueldo_minimo: payload.sueldo_minimo,
          sueldo_maximo: payload.sueldo_maximo
        },
        include: { area: { select: { id: true, nombre: true } } }
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