//src/modules/RRHH/organizacion/use-cases/cargos/actualizarCargo.UseCase.ts
//Caso de uso para actualizar un cargo en el módulo de RRHH
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActualizarCargoDto } from '@jyp/shared-contracts';

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
      const cargoActual = await this.prisma.cargo.findUnique({ where: { id } });
      this.verificarCargo(cargoActual);

      //Si el payload incluye un id_area nuevo, 
      //verificar que el area destino exista y esté activa antes de proceder con la actualización
      const idAreaTarget = payload.id_area ?? cargoActual.id_area;
      await this.validarArea(payload.id_area, cargoActual.id_area);

      //Si el payload incluye un id_jornada_sugerida nuevo, 
      //verificar que la jornada sugerida exista y esté activa antes de proceder con la actualización
      await this.validarJornada(payload.jornada_sugerida_id);

      //Verificar si el nombre del cargo está siendo modificado o si el área destino es diferente1
      await this.validarDuplicado(id, payload, cargoActual.nombre, idAreaTarget);

      return await this.prisma.cargo.update({
        where: { id },
        data: {
          id_area: payload.id_area ?? undefined,
          nombre: payload.nombre ? payload.nombre.trim() : undefined,
          descripcion: payload.descripcion ?? undefined
        },
        include: { area: { select: { id: true, nombre: true } } }
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;

      throw new InternalServerErrorException({
        title: 'Error de Actualización',
        detail: error instanceof Error ? error.message : 'No se pudo actualizar el registro del cargo.'
      });
    }
  }

  /**
   * Metodo para asegurar que el cargo existe antes de proceder con la actualización.
   * @param cargo - El cargo a verificar.
   * @throws {NotFoundException} Si el cargo no existe o ha sido eliminado.
   */
  private verificarCargo(cargo: { deleted_at: Date | null} | null) {
    if (cargo?.deleted_at !== null) throw new NotFoundException({
      title: 'Cargo no encontrado',
      detail: 'El cargo que intenta actualizar no existe o ha sido eliminado.'
    });
  }

  /**
   * Valida que el área destino exista y esté activa antes de actualizar el cargo.
   * @param idArea - El ID del área destino a validar.
   * @param currentAreaId - El ID del área actual del cargo.
   * @throws {BadRequestException} Si el área destino no existe o está inactiva.
   */
  private async validarArea(idArea: string | undefined, currentAreaId: string) {
    if (!idArea || idArea === currentAreaId) return;

    const areaDestino = await this.prisma.area.findUnique({ where: { id: idArea } });
    if (!areaDestino?.activo || areaDestino.deleted_at !== null) throw new BadRequestException({
      title: 'Área destino inválida',
      detail: 'El área a la que intenta mover el cargo no existe o está inactiva.'
    });
  }

  /**
   * Valida que la jornada sugerida exista y esté activa antes de actualizar el cargo.
   * @param jornadaId - El ID de la jornada sugerida a validar.
   * @throws {BadRequestException} Si la jornada sugerida no existe o está inactiva.
   */
  private async validarJornada(jornadaId: string | null | undefined) {
    if (jornadaId === undefined || jornadaId === null) return;

    const jornadaSugerida = await this.prisma.jornada.findUnique({ where: { id: jornadaId } });
    if (!jornadaSugerida?.activo || jornadaSugerida.deleted_at !== null) throw new BadRequestException({
      title: 'Jornada sugerida inválida',
      detail: 'La jornada laboral a vincular como sugerida no existe o está inactiva.',
    });
  }

  /**
   * Valida que no exista otro cargo con el mismo nombre en la misma área.
   * @param id - El ID del cargo a actualizar.
   * @param payload - Los datos a actualizar del cargo.
   * @param currentName - El nombre actual del cargo.
   * @param targetAreaId - El ID del área destino.
   * @throws {BadRequestException} Si se encuentra un cargo duplicado.
   */
  private async validarDuplicado( id: string, payload: ActualizarCargoDto, currentName: string, targetAreaId: string) {
    const nameChanged = Boolean(payload.nombre && payload.nombre.trim() !== currentName);
    if (!nameChanged && payload.id_area === undefined) return;

    const targetName = payload.nombre ? payload.nombre.trim() : currentName;
    const duplicate = await this.prisma.cargo.findFirst({
      where: {
        nombre: { equals: targetName, mode: 'insensitive' },
        id_area: targetAreaId,
        id: { not: id },
        deleted_at: null
      }
    });

    if (duplicate) throw new BadRequestException({
      title: 'Nombre de cargo duplicado',
      detail: `Ya existe otro cargo llamado '${targetName}' en el área destino.`
    });
  }
}
