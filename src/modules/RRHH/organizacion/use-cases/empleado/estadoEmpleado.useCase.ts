//src/modules/RRHH/use-cases/empleado/estadoEmpleado.UseCase.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type {
  DesactivarEmpleadoDto,
  CambiarEstadoLaboralDto,
} from '@jyp/shared-contracts';
import { ServerTime } from '@/common/utils/server-time';
import { estado_empleado_enum } from '@prisma/client';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import {
  anularContratos,
  anularSolicitudes,
  anularTokens,
  anularUsuario,
} from './helper/cesadoEmpleado';
import {
  verificarAreaActiva,
  verificarCargoActivo,
  verificarJornadaActiva,
} from '@/modules/RRHH/common/verificacciones-rrhh.helper';

/**
 * Caso de uso para gestionar el estado de un empleado, incluyendo la baja laboral (soft delete) y la reactivación del legajo.
 * Este caso de uso encapsula la lógica de negocio relacionada con el estado del empleado, asegurando que las operaciones se realicen de manera consistente y segura.
 */
@Injectable()
export class EstadoEmpleadoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Desactiva (da de baja) un legajo de empleado, marcando el registro como inactivo y estableciendo la fecha de cese.
   * Si el empleado no existe o ya está dado de baja, se lanza una excepción.
   * @param id - ID del empleado a desactivar.
   * @returns - El empleado desactivado con sus datos actualizados, incluyendo área y cargo.
   * @throws NotFoundException - Si el empleado no existe o ya está dado de baja.
   * @throws InternalServerErrorException - Si ocurre un error inesperado durante la operación.
   */
  async desactivar(id: string, dto?: DesactivarEmpleadoDto) {
    // Buscar el empleado por ID, asegurándose de que no esté ya dado de baja
    const empleado = await this.prisma.empleados.findUnique({
      where: { id, deleted_at: null },
    });

    // Validar que el empleado exista y esté activo antes de proceder con la desactivación
    if (!empleado) {
      throw new NotFoundException({
        title: 'Colaborador no encontrado',
        detail: 'El legajo no existe o ya se encuentra dado de baja.',
      });
    }

    // Validar y resolver la fecha de cese
    let fechaCese: Date;
    try {
      fechaCese = dto?.fecha_cese
        ? ServerTime.desdeFechaSimple(dto.fecha_cese)
        : ServerTime.obtenerFechaSimpleActual;
    } catch {
      throw new BadRequestException(
        'La fecha de cese no existe en el calendario.'
      );
    }
    if (empleado.fecha_inicio && fechaCese < empleado.fecha_inicio) {
      throw new BadRequestException(
        'La fecha de cese no puede preceder al ingreso.'
      );
    }

    // EMP-F3: Cese integral atómico (empleado + vínculo laboral + usuario + tokens + contratos + solicitudes)
    return await this.prisma.$transaction(async (tx) => {
      const empleadoCesado = await tx.empleados.update({
        where: { id },
        data: {
          activo: false,
          estado_laboral: estado_empleado_enum.CESADO,
          fecha_cese: fechaCese,
          motivo_cese: dto?.motivo_cese ?? null,
          deleted_at: ServerTime.obtenerFechaServidor,
        },
        include: {
          area: { select: { id: true, nombre: true } },
          cargo: { select: { id: true, nombre: true } },
        },
      });

      await tx.vinculo_laboral.updateMany({
        where: { empleado_id: id, fecha_cese: null },
        data: { fecha_cese: fechaCese },
      });

      await Promise.all([
        anularUsuario(tx, id),
        anularTokens(tx, id),
        anularContratos(tx, id, fechaCese),
        anularSolicitudes(tx, id),
      ]);

      return empleadoCesado;
    });
  }

  /**
   * Reactiva un legajo de empleado previamente dado de baja, restaurando su estado a activo y eliminando la fecha de cese.
   * Si el empleado no existe o ya está activo, se lanza una excepción.
   * @param id - ID del empleado a reactivar.
   * @returns - Un objeto con el estado de la operación, un mensaje y los datos del empleado reactivado.
   * @throws NotFoundException - Si el empleado no existe.
   * @throws BadRequestException - Si el empleado ya está activo.
   */
  async reactivar(id: string) {
    // Buscar el empleado por ID, asegurándose de que exista
    const empleado = await this.prisma.empleados.findUnique({
      where: { id },
      select: {
        area_id: true,
        cargo_id: true,
        jornada_id: true,
        activo: true,
        deleted_at: true,
        nro_documento: true,
      },
    });

    if (!empleado) {
      throw new NotFoundException({
        title: 'Colaborador no encontrado',
        detail: 'El legajo especificado no existe en el sistema.',
      });
    }

    if (empleado.activo && empleado.deleted_at === null) {
      throw new BadRequestException({
        title: 'Colaborador ya activo',
        detail: `El colaborador con documento ${empleado.nro_documento} ya se encuentra activo.`,
      });
    }

    // EMP-F7: Validar que el área, cargo y jornada asignados sigan activos antes del reingreso
    await Promise.all([
      verificarAreaActiva(this.prisma, empleado.area_id),
      verificarCargoActivo(this.prisma, empleado.cargo_id),
      verificarJornadaActiva(this.prisma, empleado.jornada_id),
    ]);

    const fechaReingreso = ServerTime.obtenerFechaSimpleActual;

    const empleadoReactivado = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.empleados.update({
        where: { id },
        data: {
          activo: true,
          deleted_at: null,
          estado_laboral: estado_empleado_enum.ACTIVO,
          fecha_inicio: fechaReingreso,
          fecha_cese: null,
          motivo_cese: null,
        },
        include: {
          area: { select: { id: true, nombre: true } },
          cargo: { select: { id: true, nombre: true } },
        },
      });

      await tx.vinculo_laboral.create({
        data: {
          id: IdentityGenerator.generateId(),
          empleado_id: id,
          fecha_inicio: fechaReingreso,
        },
      });

      return actualizado;
    });

    return {
      state: true,
      message:
        'Colaborador reactivado correctamente. Verifique la asignación de contratos, jornada y régimen previsional.',
      data: empleadoReactivado,
    };
  }

  /**
   * Cambiar el estado laboral de un empleado mientras sigue activo en la empresa.
   * Verifica que el empleado exista y esté activo antes de realizar el cambio.
   * Si el estado laboral es el mismo que el actual, se lanza una excepción.
   * @param id - ID del empleado cuyo estado laboral se desea cambiar.
   * @param dto - Objeto que contiene el nuevo estado laboral y un motivo opcional para el cambio.
   * @returns
   */
  async cambiarEstadoLaboral(id: string, dto: CambiarEstadoLaboralDto) {
    try {
      const empleado = await this.prisma.empleados.findUnique({
        where: { id, deleted_at: null },
      });

      if (!empleado?.activo)
        throw new NotFoundException({
          title: 'Colaborador no disponible',
          detail:
            'No se puede modificar la situación operativa de un colaborador inactivo o cesado. Debe reactivarlo primero.',
        });

      if (empleado.estado_laboral === dto.estado_laboral)
        throw new BadRequestException({
          title: 'Estado sin cambios',
          detail: `El colaborador ya se encuentra en estado '${dto.estado_laboral}'.`,
        });

      const empleadoActualizado = await this.prisma.empleados.update({
        where: { id },
        data: { estado_laboral: dto.estado_laboral },
        include: {
          area: { select: { id: true, nombre: true } },
          cargo: { select: { id: true, nombre: true } },
        },
      });

      return {
        state: true,
        message: `Estado laboral actualizado a ${dto.estado_laboral} exitosamente.`,
        data: empleadoActualizado,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;

      throw new InternalServerErrorException({
        title: 'Error al cambiar estado laboral',
        detail:
          error instanceof Error
            ? error.message
            : 'Fallo inesperado al cambiar el estado operativo.',
      });
    }
  }
}
