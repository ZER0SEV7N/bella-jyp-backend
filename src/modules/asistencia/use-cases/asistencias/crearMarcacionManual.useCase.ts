//src/modules/asistencia/use-cases/asistencias/crearMarcacionManual.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { MarcarAsistenciaDto } from '@jyp/shared-contracts';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { obtenerColaborador, validarExistencia } from '../../helpers/procesarAsistenciaWeb.helper';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { tipo_marcacion_enum } from '@prisma/client';
import { ServerTime } from '@/common/utils/server-time';
import { bloquearEmpleado, transaccionAuditada } from '@/common/utils/transaccion-auditada.util';
import { validarPeriodoEditable } from '@/modules/asistencia/helpers/periodo-editable.helper';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';

/**
 * Caso de uso para crear una marcación manual de asistencia para un empleado.
 * Este caso de uso valida la existencia del empleado, convierte la fecha y hora a UTC,
 * verifica la duplicidad de la marcación y finalmente inserta el registro en la base de datos.
 */
@Injectable()
export class CrearMarcacionManualUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para crear una marcación manual de asistencia.
   * @param dto - Objeto de transferencia de datos que contiene la información necesaria para crear la marcación,
   * incluyendo el número de documento del empleado, la fecha y hora de la marcación, y el tipo de marcación.
   * @returns - Una promesa que resuelve con el objeto de la marcación creada en la base de datos.
   * @throws ConflictException - Si ya existe una marcación para el mismo empleado, fecha y tipo de marcación.
   */
  async execute(dto: MarcarAsistenciaDto, actor: ActorOperacion) {
    //Validar existencia del colaborador
    const empleado = await obtenerColaborador(this.prisma, dto.nro_documento, dto.fecha_hora);

    //Convertir hora a UTC respetando zona horaria de Perú
    //La fecha validada por el contrato ya representa un instante.
    const fecha = dto.fecha_hora;

    if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime()))
      throw new BadRequestException('La fecha y hora de marcación no es válida.');
    if (fecha > ServerTime.obtenerFechaServidor) throw new BadRequestException('No se pueden registrar marcaciones futuras.');

    //Validar que el tipo esté habilitado en el modelo de datos.
    const tipoMarcacion = Object.values(tipo_marcacion_enum).find((tipo) => tipo === dto.tipo_marcacion);

    if (!tipoMarcacion) throw new BadRequestException('Este tipo de marcación todavía no está habilitado en el modelo de datos.');

    //Validar duplicidad
    return transaccionAuditada(this.prisma, actor, async (tx) => {
      await bloquearEmpleado(tx, empleado.id);
      await obtenerColaborador(tx, dto.nro_documento, fecha);
      await validarPeriodoEditable(tx, empleado.id, ServerTime.periodoDeInstante(fecha));
      const yaExiste = await validarExistencia(tx, empleado.id, fecha, tipoMarcacion);

      if (yaExiste)
        throw new ConflictException({
          title: 'Marcación Duplicada',
          detail: 'Ya existe una marcación registrada para este colaborador con la misma fecha y tipo.',
        });

      //Inserción con casteo estricto al enum de Prisma
      return await tx.asistencia_marcacion.create({
        data: {
          id: IdentityGenerator.generateId(),
          fecha_hora: fecha,
          tipo_marcacion: tipoMarcacion,
          empleado_id: empleado.id,
          metodo: 'MANUAL',
          motivo: dto.motivo,
          usuario_id: actor.id,
        },
      });
    });
  }
}
