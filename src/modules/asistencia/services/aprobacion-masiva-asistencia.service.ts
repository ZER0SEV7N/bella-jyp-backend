//src/modules/asistencia/services/aprobacion-masiva-asistencia.service.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  cargarContextoAsistencia,
  huellaAsistencia,
} from '../helpers/asistencia-contexto.helper';
import {
  bloquearEmpleado,
  bloquearPeriodo,
  transaccionAuditada,
} from '@/common/utils/transaccion-auditada.util';
import { validarPeriodoEditable } from '@/modules/asistencia/helpers/periodo-editable.helper';
import { validarAccionResumen } from '../helpers/acciones-resumen.helper';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';

/**
 * Servicio que maneja la aprobación masiva de incidencias de asistencia para un período específico (ASI-M4).
 * Permite aprobar las incidencias pendientes de un período determinado o de un colaborador puntual,
 * asegurando que el resumen sea aprobable, el período editable y las fuentes no hayan cambiado.
 */
@Injectable()
export class AprobacionMasivaAsistenciaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aprueba todas las incidencias pendientes de un período específico, opcionalmente filtradas por empleado.
   * La operación se realiza dentro de una transacción para garantizar la atomicidad y consistencia de los cambios.
   *
   * @param periodo - Período de asistencia en formato 'YYYY-MM' para el cual se desea aprobar las incidencias.
   * @param empleadoId - Identificador opcional del empleado; si se omite, se aprueban todas las incidencias pendientes del período.
   * @param actor - Actor que realiza la operación, incluyendo su identificador y dirección IP.
   * @returns Objeto con el período y el número de registros aprobados.
   * @throws {NotFoundException} Si no se encuentran incidencias pendientes para el período especificado.
   * @throws {BadRequestException} Si se intenta aprobar más de 100 registros a la vez.
   * @throws {ConflictException} Si algún resumen no cumple las reglas de aprobación o si las fuentes cambiaron.
   */
  async aprobarLote(
    periodo: string,
    empleadoId: string | undefined,
    actor: ActorOperacion
  ) {
    //Se ejecuta la operación de aprobación masiva dentro de una transacción de Prisma, asegurando la atomicidad y consistencia de los cambios.
    return transaccionAuditada(this.prisma, actor, async (tx) => {
      await bloquearPeriodo(tx, periodo);

      //Se buscan las incidencias pendientes para el período especificado, opcionalmente filtradas por empleado, y se ordenan por empleado_id.
      const filas = await tx.incidencias_mes.findMany({
        where: {
          periodo,
          estado: 'PENDIENTE',
          ...(empleadoId ? { empleado_id: empleadoId } : {}),
        },
        orderBy: { empleado_id: 'asc' },
        take: 101,
      });

      //Se valida que existan incidencias pendientes y que no se supere el límite de 100 registros a aprobar a la vez.
      if (!filas.length)
        throw new NotFoundException(
          'No se encontraron incidencias pendientes.'
        );
      if (filas.length > 100)
        throw new BadRequestException(
          'Para más de cien registros, apruebe por colaborador.'
        );

      //Se procesan las incidencias pendientes, bloqueando cada empleado y validando su estado.
      await filas.reduce(async (anterior, fila) => {
        await anterior;
        //Se bloquea al empleado para evitar conflictos de concurrencia durante la operación de aprobación.
        await bloquearEmpleado(tx, fila.empleado_id);
        await validarPeriodoEditable(tx, fila.empleado_id, periodo);

        validarAccionResumen(
          fila,
          'aprobar',
          empleadoId ? undefined : `El colaborador ${fila.empleado_id}: `
        );

        //Se carga el contexto de asistencia del empleado para el período especificado y se valida que las fuentes de asistencia no hayan cambiado desde la generación del resumen.
        const contexto = await cargarContextoAsistencia(
          tx,
          fila.empleado_id,
          periodo,
          ServerTime.obtenerFechaServidor
        );

        //Se valida que la huella de asistencia del contexto cargado coincida con la fuente hash almacenada en la incidencia pendiente. Si no coinciden, se lanza una excepción ConflictException indicando que las fuentes han cambiado y se debe volver a generar el resumen.
        if (huellaAsistencia(contexto) !== fila.fuente_hash)
          throw new ConflictException(
            'Las fuentes cambiaron. Vuelva a generar el resumen.'
          );
      }, Promise.resolve());

      //Se aprueban las incidencias pendientes actualizando su estado a 'APROBADO', registrando el actor que realizó la aprobación y la fecha de aprobación, y aumentando la versión de la incidencia.
      await filas.reduce(async (anterior, fila) => {
        await anterior;
        //Se actualiza la incidencia pendiente a 'APROBADO', registrando el actor que realizó la aprobación y la fecha de aprobación, y aumentando la versión de la incidencia.
        await tx.incidencias_mes.update({
          where: { id: fila.id, estado: 'PENDIENTE', version: fila.version },
          data: {
            estado: 'APROBADO',
            aprobado_por: actor.id,
            aprobado_en: new Date(),
            version: { increment: 1 },
          },
        });
      }, Promise.resolve());

      return { periodo, registros_aprobados: filas.length };
    });
  }
}
