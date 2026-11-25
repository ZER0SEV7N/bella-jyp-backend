//src/modules/nomina/planillas/helpers/verificar-planilla-abierta.helper.ts
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Verifica que la planilla del colaborador para el período siga abierta antes de modificar sus novedades (PLA-F7).
 *
 * Contexto: el trigger `PLANILLA_BLOQUEADA` de PostgreSQL rechaza cualquier cambio sobre un período
 * congelado o declarado. Sin esta validación previa, ese rechazo llegaba al cliente como un `500`.
 * La comprobación en aplicación da un `409` con un mensaje de negocio y el trigger queda como red de seguridad.
 *
 * @param tx - Transacción de Prisma en la que se ejecuta la operación.
 * @param empleadoId - Identificador del colaborador dueño de la novedad.
 * @param periodo - Período en formato `YYYY-MM`.
 * @throws ConflictException si la planilla ya fue congelada o declarada.
 */
export async function verificarPlanillaAbierta(
  tx: Prisma.TransactionClient,
  empleadoId: string,
  periodo: string
): Promise<void> {
  //Se consulta solo el estado: la novedad no necesita el detalle de la planilla.
  const planilla = await tx.historial_planillas.findUnique({
    where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } },
    select: { estado: true },
  });

  //Si todavía no existe planilla para el período, la novedad se registra y se aplicará en el primer cálculo.
  if (!planilla) return;

  //Una planilla congelada o declarada es inmutable: no admite altas, resoluciones ni anulaciones de novedades.
  if (planilla.estado === 'CONGELADO' || planilla.estado === 'DECLARADO') {
    throw new ConflictException(
      'La planilla de este mes ya está validada; sus novedades no se pueden cambiar.'
    );
  }
}
