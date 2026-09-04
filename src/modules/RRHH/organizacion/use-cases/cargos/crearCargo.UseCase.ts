//src/modules/RRHH/use-cases/cargos/crearCargo.UseCase.ts
//Caso de uso para crear un cargo en el módulo de RRHH
import {Injectable, BadRequestException,NotFoundException, InternalServerErrorException} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearCargoDto } from '@jyp/shared-contracts';
import { validarAreaActiva, validarNombreUnico, validarBandaSalarial } from './helpers/validaciones.helper';

/**
 * Clase que representa el caso de uso para crear un cargo en el módulo de RRHH.
 * Se encarga de validar la existencia y estado del área asignada antes de proceder con la creación del cargo.
 * Maneja excepciones para casos de área inválida, cargo duplicado y errores internos durante la creación.
 */
@Injectable()
export class CrearCargoUseCase {
  constructor(private readonly prisma: PrismaService) {}
 
  /**
   * Ejecuta el caso de uso para crear un nuevo cargo.
   * @param payload - Datos del nuevo cargo a crear.
   * @returns El cargo creado.
   */
  async execute(payload: CrearCargoDto) {
    try {
      // 1. Validaciones previas reutilizadas
      await validarAreaActiva(this.prisma, payload.id_area);
      await validarNombreUnico(this.prisma, payload.nombre, payload.id_area);
      validarBandaSalarial(payload.sueldo_minimo ?? 1130.0, payload.sueldo_maximo ?? null);

      // 2. Inserción en base de datos
      return await this.prisma.cargo.create({
        data: {
          id: IdentityGenerator.generateId(),
          id_area: payload.id_area,
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion?.trim() || null,
          sueldo_minimo: payload.sueldo_minimo ?? 1130.0,
          sueldo_maximo: payload.sueldo_maximo ?? null,
          activo: true
        },
        include: { area: { select: { id: true, nombre: true } } }
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException({
        title: 'Error al crear el Cargo',
        detail: error instanceof Error ? error.message : 'Fallo interno al registrar el cargo.',
      });
    }
  }
}