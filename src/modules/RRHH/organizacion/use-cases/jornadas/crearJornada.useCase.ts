//src/modules/RRHH/use-cases/jornadas/crearJornada.useCase.ts
//Caso de uso para crear una nueva jornada laboral
import { Injectable, BadRequestException,InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { calcularHorasDia } from './helper/fechaTiempo.helper';
import type { CrearJornadaDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para crear una nueva jornada laboral en el sistema.
 * Permite a los usuarios con los roles adecuados (ADMIN, RRHH) 
 * crear una jornada laboral proporcionando los detalles necesarios.
 */
@Injectable()
export class CrearJornadaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para crear una nueva jornada laboral.
   * @param payload - Datos de la nueva jornada laboral a crear.
   * @returns La jornada laboral creada con sus detalles.
   * @throws {BadRequestException} Si ya existe una jornada con el mismo nombre o si ocurre un error al crear la jornada.
   */
  async execute(dto: CrearJornadaDto) {
    try {
      //Verificar si ya existe una jornada con el mismo nombre
      const jornadaExistente = await this.prisma.jornada.findFirst({where: {
        nombre: { equals: dto.nombre.trim(), mode: 'insensitive' },
        deleted_at: null
      }});

      if (jornadaExistente)throw new BadRequestException({
        title: 'Jornada duplicada',
        detail: `Ya existe una jornada/turno con el nombre '${dto.nombre}'.`
      });

      //Validar que las áreas asignadas existan y estén activas
      const areasEncontradas = await this.prisma.area.findMany({
        where: {
          id: { in: dto.areas_ids },
          activo: true,
          deleted_at: null
        },
        select: { id: true }
      });

      if (areasEncontradas.length !== dto.areas_ids.length) throw new NotFoundException({
        title: 'Áreas no válidas',
        detail: 'Una o más áreas seleccionadas no existen o se encuentran inactivas.'
      });
      
      //Calcular el total de horas semanales según el horario configurado
      let totalSemanal = 0;
      const horarioCalculado = dto.horario_semanal.map((dia) => {
        const horas = calcularHorasDia(dia);
        totalSemanal += horas;
        return { ...dia, total_horas: horas };
      });

      //Validaciones de límites laborales
      if (dto.duracion === 'TIEMPO_PARCIAL' && totalSemanal >= 30) throw new BadRequestException({
        title: 'Límite Tiempo Parcial Excedido',
        detail: `Una jornada de tiempo parcial debe tener menos de 30 horas semanales (total configurado: ${totalSemanal}h).`
      });
      
      //Validación de límite legal de horas ordinarias
      if (totalSemanal > 48) throw new BadRequestException({
        title: 'Jornada Excede Límite Legal',
        detail: `El total semanal (${totalSemanal}h) supera el máximo legal permitido de 48 horas ordinarias.`
      });

      //Validación de patrón de rotación si el turno es ROTATIVO
      if (dto.turno === 'ROTATIVO' && !dto.patron_rotacion) throw new BadRequestException({
        title: 'Configuración Incompleta',
        detail: 'Debe especificar el patrón de rotación para jornadas de turno rotativo.',
      });
      
      //Generar un ID único para la nueva jornada
      const jornadaId = IdentityGenerator.generateId();

      //Persistencia atómica de la jornada y sus áreas aplicables
      return await this.prisma.$transaction(async (tx) => {
        const nuevaJornada = await tx.jornada.create({
          data: {
            id: jornadaId,
            nombre: dto.nombre.trim(),
            descripcion: dto.descripcion?.trim() || null,
            duracion: dto.duracion,
            turno: dto.turno,
            modalidad: dto.modalidad,
            tolerancia_minutos: dto.tolerancia_minutos,
            total_horas_semana: totalSemanal,
            horario_semanal: horarioCalculado as any,
            patron_rotacion: dto.patron_rotacion ? (dto.patron_rotacion as any) : undefined,
            activo: dto.activo ?? true
          }
        });

        //Asociar la jornada a las áreas seleccionadas
        await tx.jornada_area.createMany({data: dto.areas_ids.map((areaId) => ({
          jornada_id: jornadaId,
          area_id: areaId
        }))});

        //Devolver la nueva jornada con las áreas aplicables
        return {...nuevaJornada,areas_aplicables_ids: dto.areas_ids };
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) 
        throw error;
      
      throw new InternalServerErrorException('Ocurrió un error al registrar la nueva jornada.', error instanceof Error ? error.message : undefined);
    }
  }
}