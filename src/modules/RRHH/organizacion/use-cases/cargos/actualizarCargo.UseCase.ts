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

      if (cargoActual?.deleted_at !== null) throw new NotFoundException({
        title: 'Cargo no encontrado',
        detail: 'El cargo que intenta actualizar no existe o ha sido eliminado.'
      });

      //Si el payload incluye un id_area nuevo, 
      //verificar que el area destino exista y esté activa antes de proceder con la actualización
      const idAreaTarget = payload.id_area ?? cargoActual.id_area;
      if (payload.id_area && payload.id_area !== cargoActual.id_area) {
        const areaDestino = await this.prisma.area.findUnique({where: { id: payload.id_area }});

        if (!areaDestino?.activo || areaDestino.deleted_at !== null) throw new BadRequestException({
          title: 'Área destino inválida',
          detail: 'El área a la que intenta mover el cargo no existe o está inactiva.'
        });
      }

      //Si el payload incluye un id_jornada_sugerida nuevo, 
      //verificar que la jornada sugerida exista y esté activa antes de proceder con la actualización
      if (payload.jornada_sugerida_id !== undefined && payload.jornada_sugerida_id !== null) {
        const jornadaSugerida = await this.prisma.jornada.findUnique({where: { id: payload.jornada_sugerida_id }});

        if (!jornadaSugerida?.activo || jornadaSugerida.deleted_at !== null) throw new BadRequestException({
          title: 'Jornada sugerida inválida',
          detail: 'La jornada laboral a vincular como sugerida no existe o está inactiva.',
        });
      }

      //Verificar si el nombre del cargo está siendo modificado o si el área destino es diferente1
      if ((payload.nombre && payload.nombre.trim() !== cargoActual.nombre) || payload.id_area !== undefined) {
        const nombreTarget = payload.nombre ? payload.nombre.trim() : cargoActual.nombre;
        const duplicado = await this.prisma.cargo.findFirst({where: {
          nombre: { equals: nombreTarget, mode: 'insensitive' },
          id_area: idAreaTarget,
          id: { not: id },
          deleted_at: null
        }});

        if (duplicado) throw new BadRequestException({
          title: 'Nombre de cargo duplicado',
          detail: `Ya existe otro cargo llamado '${nombreTarget}' en el área destino.`,
        });
      }

      return await this.prisma.cargo.update({
        where: { id },
        data: {
          id_area: payload.id_area ?? undefined,
          jornada_sugerida_id: payload.jornada_sugerida_id,
          nombre: payload.nombre ? payload.nombre.trim() : undefined,
          descripcion: payload.descripcion ?? undefined
        },
        include: {
          area: { select: { id: true, nombre: true } },
          jornada_sugerida: {
            select: {
              id: true,
              nombre: true,
              tipo_jornada: true,
              hora_entrada: true,
              hora_salida: true
            }
          }
        }
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;

      throw new InternalServerErrorException({
        title: 'Error de Actualización',
        detail: error instanceof Error ? error.message : 'No se pudo actualizar el registro del cargo.',
      });
    }
  }
}
