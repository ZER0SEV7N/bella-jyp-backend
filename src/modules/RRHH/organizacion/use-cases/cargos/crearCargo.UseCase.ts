//src/modules/RRHH/use-cases/cargos/crearCargo.UseCase.ts
//Caso de uso para crear un cargo en el módulo de RRHH
import {Injectable, BadRequestException,NotFoundException, InternalServerErrorException} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearCargoDto } from '@jyp/shared-contracts';

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
      //El area asignada debe existir y estar activa.
      const areaAsignada = await this.prisma.area.findUnique({where: { id: payload.id_area }});

      if (!areaAsignada?.activo || areaAsignada.deleted_at !== null) throw new NotFoundException({  
        title: 'Área inválida',
        detail: 'El área especificada no existe o se encuentra inactiva/eliminada.'
      });
      
      if (payload.jornada_sugerida_id) {
        const jornadaSugerida = await this.prisma.jornada.findUnique({where: { id: payload.jornada_sugerida_id }});

        if (!jornadaSugerida?.activo || jornadaSugerida.deleted_at !== null) throw new NotFoundException({
          title: 'Jornada sugerida inválida',
          detail: 'La jornada laboral sugerida especificada no existe o se encuentra inactiva.'
        });
      }

      //Evitar que se creen dos cargos con el mismo nombre en la misma área
      const cargoExistente = await this.prisma.cargo.findFirst({where: {
        nombre: payload.nombre,
        id_area: payload.id_area
      }});

      if (cargoExistente)throw new BadRequestException({
        title: 'Cargo duplicado',
        detail: `Ya existe un cargo llamado '${payload.nombre}' dentro de esta área.`
      });

      //Crear el cargo en la base de datos
      return await this.prisma.cargo.create({
        data: {
          id: IdentityGenerator.generateId(),
          id_area: payload.id_area,
          jornada_sugerida_id: payload.jornada_sugerida_id || null,
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion ? payload.descripcion.trim() : null,
          activo: true
        }, include: {
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
      if (error instanceof BadRequestException || error instanceof NotFoundException) 
        throw error;

      throw new InternalServerErrorException({
        title: 'Error al crear el Cargo',
        detail: error instanceof Error ? error.message : 'Fallo interno al intentar registrar el cargo.'
      });
    }
  }
}
