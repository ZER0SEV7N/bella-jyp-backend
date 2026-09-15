//src/modules/RRHH/use-cases/empleado/editarEmpleado.useCase.ts
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EditarEmpleadoDto } from '@jyp/shared-contracts';
import { sanitizarTexto, sanitizarFecha } from '@/common/utils/transformacion.util';
import { verificarDocumentoUnico } from '@/modules/RRHH/common/verificacciones-rrhh.helper';
import { validarEntidadesEmpleado } from './helper/validacionesEmpleado';

/**
 * Caso de uso para editar un empleado en el módulo de RRHH.
 * Este caso de uso permite actualizar los datos de un empleado existente,
 * validando la unicidad del documento y las entidades relacionadas.
 */
@Injectable()
export class EditarEmpleadoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Edita un empleado existente en la base de datos.
   * @param id - ID del empleado a editar.
   * @param payload - Objeto que contiene los datos a actualizar del empleado.
   * @returns El empleado actualizado con sus datos completos.
   * @throws NotFoundException si el empleado no existe o ha sido dado de baja.
   * @throws BadRequestException si el número de documento ya está registrado para otro empleado.
   * @throws InternalServerErrorException si ocurre un error inesperado durante la operación.
   */
  async execute(id: string, payload: EditarEmpleadoDto) {
    try {
      const empleado = await this.prisma.empleados.findUnique({where: { id, deleted_at: null }});

      if (!empleado) throw new NotFoundException({
        title: 'Colaborador no encontrado',
        detail: 'El legajo no existe o ha sido dado de baja (cesado).',
      });
      
      //Validar unicidad del número de documento si se ha modificado
      if (payload.nro_documento && payload.nro_documento.trim() !== empleado.nro_documento) await verificarDocumentoUnico(this.prisma, payload.nro_documento, id);
      
      //Validar que las entidades relacionadas (área, cargo, jornada) existan y estén activas
      await validarEntidadesEmpleado(this.prisma, payload, {
        area_id: empleado.area_id,
        cargo_id: empleado.cargo_id,
        jornada_id: empleado.jornada_id
      });

      //Devolver el empleado actualizado con los datos sanitizados
      return await this.prisma.empleados.update({
        where: { id },
        data: {
          cargo_id: payload.cargo_id,
          area_id: payload.area_id,
          documento_id: payload.documento_id,
          estado_empleado_id: payload.estado_empleado_id,
          jornada_id: payload.jornada_id,
          nro_documento: sanitizarTexto(payload.nro_documento),
          nombre: sanitizarTexto(payload.nombre),
          apellido: sanitizarTexto(payload.apellido),
          email: sanitizarTexto(payload.email),
          telefono: sanitizarTexto(payload.telefono),
          sexo: payload.sexo,
          estado_civil: payload.estado_civil,
          nacionalidad: sanitizarTexto(payload.nacionalidad),
          direccion: sanitizarTexto(payload.direccion),
          referencia_direccion: sanitizarTexto(payload.referencia_direccion),
          ubigeo: sanitizarTexto(payload.ubigeo),
          distrito: sanitizarTexto(payload.distrito),
          provincia: sanitizarTexto(payload.provincia),
          departamento: sanitizarTexto(payload.departamento),
          fecha_nacimiento: sanitizarFecha(payload.fecha_nacimiento),
          fecha_inicio: sanitizarFecha(payload.fecha_inicio),
          afp_fecha_filiacion: sanitizarFecha(payload.afp_fecha_filiacion),
          asig_familiar: payload.asig_familiar
        },
        include: {
          area: { select: { id: true, nombre: true } },
          cargo: { select: { id: true, nombre: true } },
          estado_empleado: { select: { id: true, descripcion: true } },
          jornada: { select: { id: true, nombre: true } }
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;

      throw new InternalServerErrorException({
        title: 'Error de Actualización',
        detail: error instanceof Error ? error.message : 'Fallo interno al actualizar el legajo del colaborador.'
      });
    }
  }
}