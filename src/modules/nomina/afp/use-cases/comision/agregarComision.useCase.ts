//src/modules/nomina/afp/use-cases/comision/agregarComision.useCase.ts
import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { ServerTime } from '@/common/utils/server-time';
import type { CrearComisionDto } from '@jyp/shared-contracts';
import dayjs from 'dayjs';

/**
 * Caso de uso para agregar una nueva vigencia de comisión AFP (SCD Tipo 2).
 * Conserva fechas civiles UTC exactas (`ServerTime.desdeFechaSimple`) para columnas `@db.Date`
 * y persiste `comision_flujo_mixta` y `remuneracion_maxima_asegurable` requeridas por el motor de planilla.
 */
@Injectable()
export class AgregarComisionUseCase {
  private readonly logger = new Logger(AgregarComisionUseCase.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para agregar una nueva vigencia de comisión AFP.
   * Valida la existencia de la AFP, ajusta la vigencia de la comisión anterior si es necesario y crea una nueva entrada en la base de datos.
   * @param dto - Objeto de transferencia de datos que contiene la información de la nueva comisión y, opcionalmente, la comisión anterior.
   * @returns - La nueva comisión creada, incluyendo la información de la AFP asociada.
   */
  async execute(dto: CrearComisionDto) {
    // Validar la existencia de la AFP antes de proceder con la creación de la comisión
    try {
      const tipo_afp = await this.prisma.tipo_afp.findUnique({ where: { id: dto.tipo_afp_id } });
      // Si la AFP no existe, lanzar una excepción NotFoundException con un mensaje detallado
      if (!tipo_afp) throw new NotFoundException({
        title: 'AFP no encontrada',
        detail: 'La AFP seleccionada no existe en el sistema.',
      });

      // Convertir la fecha de inicio de la nueva comisión a un objeto Date en UTC para asegurar consistencia en la base de datos
      const nuevaFechaInicio = ServerTime.desdeFechaSimple(dto.nueva_comision.periodo_inicio);

      // Iniciar una transacción para asegurar que las operaciones de actualización y creación sean atómicas
      return await this.prisma.$transaction(async (tx) => {
        let comisionAnteriorId = dto.anterior_comision?.id;
        const fechaCierreAnterior = dto.anterior_comision?.periodo_final
          ? ServerTime.desdeFechaSimple(dto.anterior_comision.periodo_final)
          : new Date(Date.UTC(nuevaFechaInicio.getUTCFullYear(), nuevaFechaInicio.getUTCMonth(), nuevaFechaInicio.getUTCDate() - 1));

        // Si no se proporciona un ID de comisión anterior, buscar la última comisión abierta para la AFP especificada
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

        // Si se encuentra una comisión anterior, validar que la nueva fecha de inicio no sea anterior a la vigencia de la comisión previa y actualizar su fecha final
        if (comisionAnteriorId) {
          const anterior = await tx.comisiones_afp.findUnique({ where: { id: comisionAnteriorId } });

          if (anterior) {
            if (nuevaFechaInicio < anterior.periodo_inicio)
              throw new BadRequestException({
                title: 'Inconsistencia de Fechas',
                detail: `La fecha de inicio de la nueva comisión (${dto.nueva_comision.periodo_inicio}) no puede ser anterior a la vigencia previa (${dayjs(anterior.periodo_inicio).utc().format('YYYY-MM-DD')}).`,
              });

            await tx.comisiones_afp.update({
              where: { id: comisionAnteriorId },
              data: { periodo_final: fechaCierreAnterior },
            });
          }
        }

        // Crear la nueva comisión AFP con los datos proporcionados en el DTO y retornar el resultado, incluyendo la información de la AFP asociada
        return await tx.comisiones_afp.create({
          data: {
            id: IdentityGenerator.generateId(),
            afp_id: dto.tipo_afp_id,
            periodo_inicio: nuevaFechaInicio,
            periodo_final: dto.nueva_comision.periodo_final
              ? ServerTime.desdeFechaSimple(dto.nueva_comision.periodo_final)
              : null,
            aporte_obligatorio: dto.nueva_comision.aporte_obligatorio,
            comision_sobre_ra: dto.nueva_comision.comision_sobre_ra,
            prima_seguro: dto.nueva_comision.prima_seguro,
            comision_mixta: dto.nueva_comision.comision_mixta,
            comision_flujo_mixta: dto.nueva_comision.comision_flujo_mixta ?? 0,
            remuneracion_maxima_asegurable: dto.nueva_comision.remuneracion_maxima_asegurable ?? 0,
          },
          include: {
            tipo_afp: { select: { id: true, nombre: true } },
          },
        });
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;

      this.logger.error('Error al registrar comisión de AFP:', error);
      throw new InternalServerErrorException(
        'Ocurrió un error al intentar registrar la comisión de la AFP',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
