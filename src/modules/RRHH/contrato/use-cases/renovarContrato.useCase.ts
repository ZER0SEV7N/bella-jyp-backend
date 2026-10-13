//src/modules/RRHH/contrato/use-cases/renovarContrato.useCase.ts
import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { RenovarContratoDto } from '@jyp/shared-contracts';
import { sanitizarFecha } from '@/common/utils/transformacion.util';
import { estado_contrato_enum } from '@prisma/client';

/**
 * Caso de uso para renovar un contrato en el módulo de RRHH
 * Contiene la lógica de negocio para renovar un contrato en la base de datos utilizando Prisma.
 * Se encarga de recibir el ID del contrato a renovar y los datos del nuevo contrato, validar la existencia del contrato y del empleado, y crear un nuevo contrato asociado al mismo empleado.
 * En caso de error, lanza una excepción interna del servidor con un mensaje descriptivo.
 */
@Injectable()
export class RenovarContratoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea un nuevo contrato como renovación del contrato existente
   * Regla de negocio: No se permite renovar un contrato si el empleado asociado está cesado.
   * @param idViejoContrato  El ID del contrato que se va a renovar
   * @param dto Los datos del nuevo contrato a crear
   * @returns Una promesa que resuelve con el nuevo contrato creado
   * @throws NotFoundException si el contrato a renovar no existe o ha sido eliminado
   */
  async execute(idViejoContrato: string, dto: RenovarContratoDto) {
    //Buscar el contrato existente para validar su existencia y obtener el empleado asociado
    const contratoViejo = await this.prisma.contratos.findUnique({
      where: { id: idViejoContrato, deleted_at: null },
      include: { empleados: { select: { id: true, activo: true } } },
    });

    //Validaciones de negocio
    if (!contratoViejo) throw new NotFoundException('El contrato previo a renovar no existe o ha sido eliminado.');
    if (!contratoViejo.empleados?.activo) throw new BadRequestException('No se puede prorrogar un contrato para un colaborador inactivo o cesado.');
    if (contratoViejo.estado === estado_contrato_enum.RENOVADO) throw new BadRequestException('Este contrato ya fue renovado previamente por otra adenda.');
    
    //Normalizar fechas de inicio y fin del nuevo contrato
    const nuevaFechaInicio = sanitizarFecha(dto.fecha_inicio);
    const nuevaFechaFin = sanitizarFecha(dto.fecha_fin);

    //Validaciones de fechas
    if (!nuevaFechaInicio) throw new BadRequestException('La nueva fecha de inicio es obligatoria.');
    if (nuevaFechaFin && nuevaFechaInicio > nuevaFechaFin) throw new BadRequestException('La fecha de inicio de la prórroga no puede superar a su fecha de fin.');
    
    try {
      return await this.prisma.$transaction(async (tx) => {
        //Cerrar el contrato anterior como RENOVADO
        await tx.contratos.update({
          where: { id: idViejoContrato },
          data: { estado: estado_contrato_enum.RENOVADO },
        });

        //Crear la prórroga enlazada genealógicamente
        return await tx.contratos.create({
          data: {
            id: IdentityGenerator.generateId(),
            empleado_id: contratoViejo.empleado_id,
            estado: estado_contrato_enum.VIGENTE,
            tipo_modalidad: dto.tipo_modalidad || contratoViejo.tipo_modalidad,
            fecha_inicio: nuevaFechaInicio,
            fecha_fin: nuevaFechaFin ?? null,
            observacion: dto.observacion?.trim() ?? `Prórroga del contrato anterior (${contratoViejo.id})`,
            url: null, //Nuevo contrato empieza pendiente de firma/PDF
            contrato_origen_id: idViejoContrato, //Trazabilidad relacional
          },
        });
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Error al procesar la renovación del contrato.', error instanceof Error ? error.message : String(error));
    }
  }
}