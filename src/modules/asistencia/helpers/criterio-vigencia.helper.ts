//src/modules/asistencia/helpers/criterio-vigencia.helper.ts
import { Prisma } from '@prisma/client';
import { ServerTime } from '@/common/utils/server-time';

/**
 * Criterio de vínculo laboral vigente en un período (ASI-F6).
 *
 * Un colaborador es visible en el período si:
 * - Está activo (`deleted_at: null`), o
 * - Su vínculo cruza el período (`fecha_inicio <= finMes` y no cesado, o cesado a partir del
 *   inicio del mes). Esto incluye a un colaborador cesado a mitad de mes, para que se calculen
 *   los días trabajados y el resto quede `FUERA_DE_VINCULO` en el motor.
 *
 * @param periodo - Período en formato `YYYY-MM`.
 * @returns Fragmento de `where` de Prisma listo para combinar con filtros adicionales.
 */
export function criterioVigenciaEnPeriodo(periodo: string): Prisma.empleadosWhereInput {
  const { year, month } = ServerTime.validarPeriodo(periodo);
  const inicio = ServerTime.desdeFechaSimple(`${periodo}-01`);
  const fin = new Date(Date.UTC(year, month, 0));

  return {
    OR: [
      { deleted_at: null },
      {
        fecha_inicio: { lte: fin },
        OR: [{ fecha_cese: null }, { fecha_cese: { gte: inicio } }],
      },
    ],
  };
}
