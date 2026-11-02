//src/modules/asistencia/use-cases/Incidencias/resolverIncidencia.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ResolverIncidenciaDto } from '@jyp/shared-contracts';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { bloquearEmpleado, transaccionAuditada } from '@/common/utils/transaccion-auditada.util';
import { validarPeriodoEditable } from '@/modules/asistencia/helpers/periodo-editable.helper';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';

/**
 * Caso de uso para resolver una incidencia de asistencia de un empleado.
 * Este caso de uso valida que la incidencia exista, que el período sea editable y que la acción sea válida,
 * y luego realiza la operación de resolver la incidencia dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
 * @requires - PrismaService para acceder a la base de datos y realizar operaciones de lectura y escritura.
 */
@Injectable()
export class ResolverIncidenciaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para resolver una incidencia de asistencia de un empleado.
   * Valida que la incidencia exista, que el período sea editable y que la acción sea válida,
   * y luego realiza la operación de resolver la incidencia dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
   * @param dto - Objeto que contiene los datos necesarios para resolver la incidencia del empleado.
   * @param actor - El actor que realiza la operación de resolución de incidencia.
   * @returns - Promesa que se resuelve con el resultado de la operación si es exitosa.
   * @throws - Error de tipo NotFoundException si la incidencia no existe.
   * @throws - Error de tipo ConflictException si se intenta rechazar una incidencia que no está pendiente o reabrir una que ya está pendiente.
   */
  async execute(dto: ResolverIncidenciaDto, actor: ActorOperacion) {
    //Se ejecuta la operación de resolver la incidencia dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
    return transaccionAuditada(this.prisma, actor, async (tx) => {
      //Se bloquea al empleado para evitar conflictos de concurrencia durante la operación.
      await bloquearEmpleado(tx, dto.empleado_id);
      await validarPeriodoEditable(tx, dto.empleado_id, dto.periodo, true);
      //Se busca la incidencia del empleado para el período especificado. Si no se encuentra, se lanza una excepción NotFoundException.
      const actual = await tx.incidencias_mes.findUnique({
        where: { empleado_id_periodo: { empleado_id: dto.empleado_id, periodo: dto.periodo } },
      });
      //Si la incidencia no existe, se lanza una excepción NotFoundException indicando que la incidencia no se encuentra.
      if (!actual) throw new NotFoundException('La incidencia no existe.');
      //Se valida que la acción sea válida según el estado actual de la incidencia. Si no es válida, se lanza una excepción ConflictException.
      if (dto.accion === 'RECHAZAR' && actual.estado !== 'PENDIENTE')
        throw new ConflictException('Solo se puede rechazar una incidencia pendiente.');
      //Se actualiza la incidencia del empleado para el período especificado, estableciendo el nuevo estado, motivo de revisión y otros campos según la acción realizada.
      if (dto.accion === 'REABRIR' && actual.estado === 'PENDIENTE') throw new ConflictException('La incidencia ya está pendiente.');

      //Se actualiza la incidencia del empleado para el período especificado, estableciendo el nuevo estado, motivo de revisión y otros campos según la acción realizada.
      return tx.incidencias_mes.update({
        where: { id: actual.id, version: actual.version },
        data: {
          estado: dto.accion === 'RECHAZAR' ? 'RECHAZADO' : 'PENDIENTE',
          motivo_revision: dto.motivo,
          vigente: false,
          aprobado_por: null,
          aprobado_en: null,
          version: { increment: 1 },
        },
      });
    });
  }
}
