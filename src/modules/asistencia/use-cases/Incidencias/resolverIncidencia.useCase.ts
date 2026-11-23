//src/modules/asistencia/use-cases/Incidencias/resolverIncidencia.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ResolverIncidenciaDto } from '@jyp/shared-contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  bloquearEmpleado,
  transaccionAuditada,
} from '@/common/utils/transaccion-auditada.util';
import { validarPeriodoEditable } from '@/modules/asistencia/helpers/periodo-editable.helper';
import { validarAccionResumen } from '@/modules/asistencia/helpers/acciones-resumen.helper';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';

/**
 * Caso de uso para resolver (rechazar o reabrir) una incidencia mensual de asistencia (ASI-M4).
 * Valida la existencia del resumen, que el período sea editable y que la acción esté permitida según su estado.
 */
@Injectable()
export class ResolverIncidenciaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el rechazo o reapertura de la incidencia mensual de un empleado dentro de una transacción auditada.
   *
   * @param dto - Datos necesarios para resolver la incidencia del empleado.
   * @param actor - Actor autenticado que realiza la operación.
   * @returns Registro de `incidencias_mes` actualizado.
   * @throws {NotFoundException} Si la incidencia no existe para el empleado y período.
   * @throws {ConflictException} Si el período no es editable o la acción no está permitida sobre el resumen.
   */
  async execute(dto: ResolverIncidenciaDto, actor: ActorOperacion) {
    //Se ejecuta la operación de resolver la incidencia dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
    return transaccionAuditada(this.prisma, actor, async (tx) => {
      //Se bloquea al empleado para evitar conflictos de concurrencia durante la operación.
      await bloquearEmpleado(tx, dto.empleado_id);
      await validarPeriodoEditable(tx, dto.empleado_id, dto.periodo, true);
      //Se busca la incidencia del empleado para el período especificado. Si no se encuentra, se lanza una excepción NotFoundException.
      const actual = await tx.incidencias_mes.findUnique({
        where: {
          empleado_id_periodo: {
            empleado_id: dto.empleado_id,
            periodo: dto.periodo,
          },
        },
      });
      //Si la incidencia no existe, se lanza una excepción NotFoundException indicando que la incidencia no se encuentra.
      if (!actual) throw new NotFoundException('La incidencia no existe.');

      validarAccionResumen(
        actual,
        dto.accion === 'RECHAZAR' ? 'rechazar' : 'reabrir'
      );

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
