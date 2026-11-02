//src/modules/asistencia/helpers/periodo-editable.helper.ts
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Helper que valida si un período de asistencia de un empleado es editable.
 * Este helper verifica el estado de la planilla y la incidencia del período especificado para determinar si se pueden realizar cambios en la asistencia.
 * Si la planilla está cerrada o la incidencia está aprobada y no se permite modificarla, lanza una excepción ConflictException.
 */

/**
 * Valida si el período de asistencia de un empleado es editable.
 * Verifica el estado de la planilla y la incidencia del período especificado para determinar si se pueden realizar cambios en la asistencia.
 * @param tx - La transacción de Prisma en la que se ejecuta la validación.
 * @param empleadoId - El identificador del empleado cuyo período se desea validar.
 * @param periodo - El período de asistencia en formato 'YYYY-MM'.
 * @param permitirAprobada - Indica si se permite modificar un período con incidencia aprobada (por defecto es false).
 * @returns - Una promesa que se resuelve si el período es editable; de lo contrario, lanza una excepción ConflictException.
 * @throws - ConflictException si la planilla está cerrada o si la incidencia está aprobada y no se permite modificarla.
 */
export async function validarPeriodoEditable(tx: Prisma.TransactionClient, empleadoId: string, periodo: string, permitirAprobada = false): Promise<void> {
    //Se busca la planilla del empleado para el período especificado y se obtiene su estado.
    const planilla = await tx.historial_planillas.findUnique({
        where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } },
        select: { estado: true },
    });

    //Si la planilla existe y su estado no es 'ABIERTO', se lanza una excepción ConflictException indicando que no se puede alterar la asistencia.
    if (planilla && planilla.estado !== 'ABIERTO')
        throw new ConflictException(`La planilla ${periodo} está ${planilla.estado}. No se puede alterar su asistencia.`);

    //Se busca la incidencia del empleado para el período especificado y se obtiene su estado.
    const incidencia = await tx.incidencias_mes.findUnique({
        where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } },
        select: { estado: true },
    });

    //Si la incidencia existe y su estado es 'APROBADO', y no se permite modificarla, se lanza una excepción ConflictException.
    if (!permitirAprobada && incidencia?.estado === 'APROBADO')
        throw new ConflictException('Debe reabrir expresamente la incidencia aprobada antes de modificar sus fuentes.');
}
