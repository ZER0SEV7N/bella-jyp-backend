//src/modules/asistencia/helpers/acciones-resumen.helper.ts
import { ConflictException } from '@nestjs/common';
import type { estado_incidencia_enum } from '@prisma/client';

const MENSAJE_PLANILLA_NO_ABIERTA =
  'La planilla de este mes ya no está abierta: no se puede cambiar su asistencia.';
export const ALERTA_SIN_JORNADA = 'JORNADA_HISTORICA_NO_ASIGNADA';

/**
 * Motivos por los cuales cada acción del resumen mensual está bloqueada, o `null` si está permitida.
 */
export interface AccionesResumen {
  aprobar: string | null;
  rechazar: string | null;
  reabrir: string | null;
}

/**
 * Campos mínimos de un resumen mensual de incidencias necesarios para evaluar sus acciones permitidas.
 */
export interface ResumenEvaluable {
  estado: estado_incidencia_enum;
  vigente: boolean;
  completo: boolean;
  pendientes: number;
  detalle?: unknown;
}

function etiquetaDias(cantidad: number): string {
  return cantidad === 1 ? '1 día' : `${cantidad} días`;
}

function contarDiasSinJornada(detalle: unknown): number {
  if (!detalle || typeof detalle !== 'object' || Array.isArray(detalle)) {
    return 0;
  }

  const dias = (detalle as Record<string, unknown>).dias;
  if (!Array.isArray(dias)) {
    return 0;
  }

  let total = 0;
  for (const dia of dias) {
    if (!dia || typeof dia !== 'object' || Array.isArray(dia)) {
      continue;
    }
    const alertas = (dia as Record<string, unknown>).alertas;
    if (Array.isArray(alertas) && alertas.includes(ALERTA_SIN_JORNADA)) {
      total += 1;
    }
  }
  return total;
}

function motivoAprobar(resumen: ResumenEvaluable): string | null {
  if (resumen.estado !== 'PENDIENTE') {
    return 'Solo se puede aprobar un resumen pendiente.';
  }
  if (!resumen.vigente) {
    return 'El resumen está desactualizado: actualízalo para poder aprobarlo.';
  }

  const diasSinJornada = contarDiasSinJornada(resumen.detalle);
  if (diasSinJornada > 0) {
    return `Hay ${etiquetaDias(diasSinJornada)} sin jornada asignada: asigna una jornada y actualiza el resumen para poder aprobarlo.`;
  }

  if (resumen.pendientes > 0) {
    return `Hay ${etiquetaDias(resumen.pendientes)} por resolver antes de aprobar.`;
  }

  if (!resumen.completo) {
    return 'Todavía hay días sin evaluar: se podrá aprobar cuando el mes esté completo.';
  }

  return null;
}

/**
 * Calcula qué acciones están permitidas sobre un resumen mensual de asistencia y el motivo si alguna está bloqueada (ASI-M4).
 *
 * @param resumen - Datos del resumen mensual a evaluar.
 * @param estadoPlanilla - Estado de la planilla del colaborador en el período, si existe.
 * @returns Objeto con `null` en las acciones permitidas o el mensaje de negocio en español si están bloqueadas.
 */
export function calcularAccionesResumen(
  resumen: ResumenEvaluable,
  estadoPlanilla?: string | null
): AccionesResumen {
  if (estadoPlanilla && estadoPlanilla !== 'ABIERTO') {
    return {
      aprobar: MENSAJE_PLANILLA_NO_ABIERTA,
      rechazar: MENSAJE_PLANILLA_NO_ABIERTA,
      reabrir: MENSAJE_PLANILLA_NO_ABIERTA,
    };
  }

  return {
    aprobar: motivoAprobar(resumen),
    rechazar:
      resumen.estado !== 'PENDIENTE'
        ? 'Solo se puede rechazar un resumen pendiente.'
        : null,
    reabrir:
      resumen.estado === 'PENDIENTE' ? 'El resumen ya está pendiente.' : null,
  };
}

/**
 * Valida si una acción sobre el resumen mensual está permitida y lanza un conflicto con su motivo de negocio si no lo está (ASI-M4).
 *
 * @param resumen - Datos del resumen mensual a evaluar.
 * @param accion - Acción que se intenta ejecutar (`aprobar`, `rechazar` o `reabrir`).
 * @param prefijoDetalle - Prefijo opcional para identificar el registro afectado al inicio del detalle.
 * @returns No devuelve valor cuando la acción está permitida.
 * @throws {ConflictException} Si la acción no está permitida según el estado del resumen.
 */
export function validarAccionResumen(
  resumen: ResumenEvaluable,
  accion: keyof AccionesResumen,
  prefijoDetalle?: string
): void {
  const motivo = calcularAccionesResumen(resumen)[accion];
  if (motivo !== null) {
    throw new ConflictException({
      title: 'Acción no permitida',
      detail: prefijoDetalle ? `${prefijoDetalle}${motivo}` : motivo,
    });
  }
}
