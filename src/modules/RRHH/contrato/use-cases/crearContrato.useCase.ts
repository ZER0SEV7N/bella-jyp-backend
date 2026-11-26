//src/modules/RRHH/contrato/use-cases/crearContrato.useCase.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CrearContratoDto } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { sanitizarFecha } from '@/common/utils/transformacion.util';
import { estado_contrato_enum } from '@prisma/client';

/**
 * Caso de uso para crear un contrato en el módulo de RRHH
 * Contiene la lógica de negocio para crear un contrato en la base de datos utilizando Prisma.
 * Se encarga de recibir los datos del contrato, generar un UUID único y almacenar la información en la base de datos.
 * En caso de error, lanza una excepción interna del servidor con un mensaje descriptivo.
 */
@Injectable()
export class CrearContratoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  
  /**
   * Ejecuta el caso de uso para crear un contrato
   * @param datosContrato Los datos del contrato a crear
   * @param URL La URL del contrato
   * @returns Una promesa que resuelve con el contrato creado
   */
  async execute(dto: CrearContratoDto, urlPdf?: string) {
    // Validar que el empleado exista y esté activo
    const empleado = await this.prisma.empleados.findUnique({
      where: { id: dto.empleado_id, deleted_at: null },
      select: { id: true, activo: true, deleted_at: true },
    });

    // Validar que el empleado exista y esté activo
    if (!empleado?.activo) {
      throw new NotFoundException({
        title: 'Empleado no disponible',
        detail: 'No se encontró un empleado activo con el ID proporcionado.',
      });
    }

    // Normalizar fechas con sanitizarFecha
    const fechaInicio = sanitizarFecha(dto.fecha_inicio);
    const fechaFin = sanitizarFecha(dto.fecha_fin);

    if (!fechaInicio) {
      throw new BadRequestException('La fecha de inicio es obligatoria y debe ser válida.');
    }
    if (fechaFin && fechaInicio > fechaFin) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.');
    }

    // Garantizar atómicamente un único contrato VIGENTE por colaborador
    return await this.prisma.$transaction(async (tx) => {
      const contratoVigente = await tx.contratos.findFirst({
        where: {
          empleado_id: dto.empleado_id,
          estado: estado_contrato_enum.VIGENTE,
          deleted_at: null,
        },
        select: { id: true },
      });

      // Si ya existe un contrato VIGENTE para el empleado, lanzar un error de conflicto
      if (contratoVigente) {
        throw new ConflictException({
          title: 'Contrato vigente duplicado',
          detail:
            'El colaborador ya cuenta con un contrato VIGENTE. Renueve o anule el contrato actual antes de crear uno nuevo.',
          campo: 'empleado_id',
        });
      }

      return tx.contratos.create({
        data: {
          id: IdentityGenerator.generateId(),
          empleado_id: dto.empleado_id,
          tipo_modalidad: dto.tipo_modalidad || 'PLAZO_FIJO',
          estado: estado_contrato_enum.VIGENTE,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin ?? null,
          observacion: dto.observacion?.trim() ?? null,
          url: urlPdf ?? null,
          contrato_origen_id: null,
        },
        include: {
          empleados: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              nro_documento: true,
            },
          },
        },
      });
    });
  }
}