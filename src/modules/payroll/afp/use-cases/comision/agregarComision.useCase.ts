//src/modules/afp/use-cases/agregarComision.useCase.ts
import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearComisionDto } from '@jyp/shared-contracts';
import dayjs from 'dayjs';

/**
 * Caso de uso para agregar una nueva comisión de AFP.
 * Tiene como objetivo validar que el tipo de AFP exista y crear una nueva comisión en la base de datos.
 * @param dto - Objeto de transferencia de datos que contiene la información de la nueva comisión a crear.
 * @returns Una promesa que resuelve con la nueva comisión creada.
 */
@Injectable()
export class AgregarComisionUseCase {
  private readonly logger = new Logger(AgregarComisionUseCase.name);
  constructor(private readonly prisma: PrismaService) {}
  

  /**
   * Metodo principal que ejecuta la lógica de negocio para agregar una nueva comisión de AFP.
   * @param dto - Objeto de transferencia de datos que contiene la información de la nueva comisión a crear.
   * @returns Una promesa que resuelve con la nueva comisión creada.
   */
  async execute(dto: CrearComisionDto) {
    try {
      //validar que el tipo de afp exista
      const tipo_afp = await this.prisma.tipo_afp.findUnique({where: { id: dto.tipo_afp_id }});
      //validar si es valido
      if (!tipo_afp) throw new NotFoundException({
        title: 'AFP no encontrada',
        detail: 'La AFP seleccionada no existe en el sistema.'
      });

      const nuevaFechaInicio = dayjs(dto.nueva_comision.periodo_inicio).startOf('day').toDate();

      //Transacción interactiva atómica (SCD Tipo 2 automatizado)
      return await this.prisma.$transaction(async (tx) => {
        let comisionAnteriorId = dto.anterior_comision?.id;
        let fechaCierreAnterior = dto.anterior_comision?.periodo_final
          ? dayjs(dto.anterior_comision.periodo_final).endOf('day').toDate()
          : dayjs(nuevaFechaInicio).subtract(1, 'day').endOf('day').toDate();

        //Si no se envió ID anterior explícito, buscar la comisión actualmente abierta
        if (!comisionAnteriorId) {
          const comisionAbierta = await tx.comisiones_afp.findFirst({
            where: {
              afp_id: dto.tipo_afp_id,
              periodo_final: null,
            },
            orderBy: { periodo_inicio: 'desc' },
          });

          if (comisionAbierta) comisionAnteriorId = comisionAbierta.id;
        }

        //Si existe una comisión previa que cerrar, validar coherencia y cerrarla
        if (comisionAnteriorId) {
          const anterior = await tx.comisiones_afp.findUnique({ where: { id: comisionAnteriorId } });

          //Validar que la fecha de inicio de la nueva comisión no sea anterior a la fecha de inicio de la comisión anterior
          if (anterior) {
            if (dayjs(nuevaFechaInicio).isBefore(dayjs(anterior.periodo_inicio))) throw new BadRequestException({
              title: 'Inconsistencia de Fechas',
              detail: `La fecha de inicio de la nueva comisión (${dto.nueva_comision.periodo_inicio}) no puede ser anterior a la vigencia previa (${dayjs(anterior.periodo_inicio).format('YYYY-MM-DD')}).`,
            });
            
            await tx.comisiones_afp.update({
              where: { id: comisionAnteriorId },
              data: { periodo_final: fechaCierreAnterior }
            });
          }
        }

        //Crear el nuevo registro con vigencia abierta
        const nuevaComision = await tx.comisiones_afp.create({
          data: {
            id: IdentityGenerator.generateId(),
            afp_id: dto.tipo_afp_id,
            periodo_inicio: nuevaFechaInicio,
            periodo_final: dto.nueva_comision.periodo_final ? dayjs(dto.nueva_comision.periodo_final).toDate() : null,
            aporte_obligatorio: dto.nueva_comision.aporte_obligatorio,
            comision_sobre_ra: dto.nueva_comision.comision_sobre_ra,
            prima_seguro: dto.nueva_comision.prima_seguro,
            comision_mixta: dto.nueva_comision.comision_mixta,
          },
          include: {
            tipo_afp: { select: { id: true, nombre: true } }
          }
        });

        return nuevaComision;
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      
      this.logger.error('Error al registrar comisión de AFP:', error);
      throw new InternalServerErrorException('Ocurrió un error al intentar registrar la comisión de la AFP', error instanceof Error ? error.message : String(error));
    }
  }
}