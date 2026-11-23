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
export async function validarPeriodoEditable(
  tx: Prisma.TransactionClient,
  empleadoId: string,
  periodo: string,
  permitirAprobada = false
): Promise<void> {
  //Se busca la planilla del empleado para el período especificado y se obtiene su estado.
  const planilla = await tx.historial_planillas.findUnique({
    where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } },
    select: { estado: true },
  });

  //Si la planilla existe y su estado no es 'ABIERTO', se lanza una excepción ConflictException indicando que no se puede alterar la asistencia.
  if (planilla && planilla.estado !== 'ABIERTO')
    throw new ConflictException(
      `La planilla ${periodo} está ${planilla.estado}. No se puede alterar su asistencia.`
    );

  //Se busca la incidencia del empleado para el período especificado y se obtiene su estado.
  const incidencia = await tx.incidencias_mes.findUnique({
    where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } },
    select: { estado: true },
  });

  //Si la incidencia existe y su estado es 'APROBADO', y no se permite modificarla, se lanza una excepción ConflictException.
  if (!permitirAprobada && incidencia?.estado === 'APROBADO')
    throw new ConflictException(
      'Debe reabrir expresamente la incidencia aprobada antes de modificar sus fuentes.'
    );
}

type ClientePeriodos = Pick<
  Prisma.TransactionClient,
  'incidencias_mes' | 'historial_planillas'
>;

/**
 * Lista los períodos cerrados dentro de un conjunto dado de períodos (ASI-F3).
 * Un período se considera cerrado si tiene al menos una incidencia aprobada o una planilla en estado distinto de 'ABIERTO'.
 *
 * @param tx - Cliente o transacción de Prisma para consultar incidencias y planillas.
 * @param periodos - Lista de períodos en formato 'YYYY-MM' a evaluar.
 * @returns Arreglo ordenado con los períodos cerrados encontrados.
 */
export async function listarPeriodosCerrados(
  tx: ClientePeriodos,
  periodos: string[]
): Promise<string[]> {
  if (periodos.length === 0) return [];

  const [incidencias, planillas] = await Promise.all([
    tx.incidencias_mes.findMany({
      where: { periodo: { in: periodos }, estado: 'APROBADO' },
      select: { periodo: true },
      distinct: ['periodo'],
    }),
    tx.historial_planillas.findMany({
      where: { periodo: { in: periodos }, estado: { not: 'ABIERTO' } },
      select: { periodo: true },
      distinct: ['periodo'],
    }),
  ]);

  const cerrados = new Set<string>();
  for (const fila of incidencias) cerrados.add(fila.periodo);
  for (const fila of planillas) cerrados.add(fila.periodo);
  return Array.from(cerrados).sort((a, b) => a.localeCompare(b));
}

/**
 * Valida que el período correspondiente a una fecha del calendario no esté cerrado (ASI-F3).
 *
 * @param tx - Cliente o transacción de Prisma para verificar aprobaciones y planillas del período.
 * @param fecha - Fecha civil en formato 'YYYY-MM-DD'.
 * @returns Promesa vacía si el período está abierto y admite cambios en el calendario.
 * @throws {ConflictException} Si existen resúmenes aprobados o una planilla no abierta en el período.
 */
export async function validarFechaSinPeriodoCerrado(
  tx: ClientePeriodos,
  fecha: string
): Promise<void> {
  const periodo = fecha.slice(0, 7);
  const [aprobados, planillaCerrada] = await Promise.all([
    tx.incidencias_mes.count({ where: { periodo, estado: 'APROBADO' } }),
    tx.historial_planillas.findFirst({
      where: { periodo, estado: { not: 'ABIERTO' } },
      select: { id: true },
    }),
  ]);

  if (aprobados > 0 || planillaCerrada) {
    const detalleAprobados =
      aprobados > 0
        ? ` (${aprobados} ${aprobados === 1 ? 'colaborador aprobado' : 'colaboradores aprobados'})`
        : '';
    throw new ConflictException({
      title: 'Periodo cerrado',
      detail: `El periodo ${periodo} tiene resúmenes aprobados${detalleAprobados} o una planilla cerrada. Reabra el periodo antes de modificar el calendario.`,
    });
  }
}

/**
 * Valida que un colaborador no tenga períodos cerrados desde el mes de inicio de una nueva jornada en adelante (ASI-F2).
 *
 * @param tx - Cliente o transacción de Prisma para verificar las incidencias y planillas del colaborador.
 * @param empleadoId - Identificador del colaborador.
 * @param desde - Fecha de inicio de vigencia de la jornada en formato 'YYYY-MM-DD'.
 * @returns Promesa vacía si ningún período igual o posterior está cerrado para el colaborador.
 * @throws {ConflictException} Si existe un resumen aprobado o una planilla no abierta en un período afectado.
 */
export async function validarJornadaSinPeriodosCerrados(
  tx: ClientePeriodos,
  empleadoId: string,
  desde: string
): Promise<void> {
  const periodoDesde = desde.slice(0, 7);
  const [incidenciaCerrada, planillaCerrada] = await Promise.all([
    tx.incidencias_mes.findFirst({
      where: {
        empleado_id: empleadoId,
        periodo: { gte: periodoDesde },
        estado: 'APROBADO',
      },
      select: { periodo: true },
      orderBy: { periodo: 'asc' },
    }),
    tx.historial_planillas.findFirst({
      where: {
        empleado_id: empleadoId,
        periodo: { gte: periodoDesde },
        estado: { not: 'ABIERTO' },
      },
      select: { periodo: true },
      orderBy: { periodo: 'asc' },
    }),
  ]);

  const periodoCerrado = [incidenciaCerrada?.periodo, planillaCerrada?.periodo]
    .filter((p): p is string => Boolean(p))
    .sort((a, b) => a.localeCompare(b))[0];

  if (periodoCerrado) {
    throw new ConflictException({
      title: 'Periodo cerrado',
      detail: `El colaborador tiene el periodo ${periodoCerrado} con resumen aprobado o planilla cerrada desde ${periodoDesde}. Reabra el periodo antes de asignar una jornada.`,
    });
  }
}
