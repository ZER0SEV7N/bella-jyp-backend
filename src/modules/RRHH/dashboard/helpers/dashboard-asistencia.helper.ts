//src/modules/RRHH/dashboard/helpers/dashboard-asistencia.helper.ts
import type { DashboardRrhhResponseDto } from '@jyp/shared-contracts';
import { ALERTA_SIN_JORNADA } from '@/modules/asistencia/helpers/acciones-resumen.helper';
import { redondearDosDecimales } from './dashboard-dotacion.helper';

type AsistenciaSemanaDashboard = DashboardRrhhResponseDto['asistencia_semana'];
type DiaAsistenciaSemana = AsistenciaSemanaDashboard['dias'][number];

const ESTADOS_EXCLUIDOS = new Set([
  'FUERA_DE_VINCULO',
  'DESCANSO_SEMANAL',
  'FERIADO_O_DESCANSO_ACORDADO',
  'NO_EVALUADO',
]);

const ESTADOS_JUSTIFICADAS = new Set(['JUSTIFICADA', 'AUSENCIA_SIN_GOCE']);

/**
 * Fila mínima leída de `incidencias_mes` para consolidar la semana laboral.
 */
export interface FilaIncidenciaSemana {
  detalle: unknown;
  actualizado_en: Date;
}

interface DiaDetalleValidado {
  fecha: string;
  estado: string;
  minutos_tardanza: number;
  alertas: string[];
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function leerDiaDetalle(item: unknown): DiaDetalleValidado | null {
  if (!esObjeto(item)) {
    return null;
  }

  if (typeof item.fecha !== 'string' || typeof item.estado !== 'string') {
    return null;
  }

  const minutosTardanza =
    typeof item.minutos_tardanza === 'number' &&
    Number.isFinite(item.minutos_tardanza)
      ? item.minutos_tardanza
      : 0;

  const alertas = Array.isArray(item.alertas)
    ? item.alertas.filter(
        (alerta): alerta is string => typeof alerta === 'string'
      )
    : [];

  return {
    fecha: item.fecha,
    estado: item.estado,
    minutos_tardanza: minutosTardanza,
    alertas,
  };
}

function extraerDiasDetalle(detalle: unknown): DiaDetalleValidado[] {
  if (!esObjeto(detalle) || !Array.isArray(detalle.dias)) {
    return [];
  }

  const dias: DiaDetalleValidado[] = [];
  for (const item of detalle.dias) {
    const dia = leerDiaDetalle(item);
    if (dia) {
      dias.push(dia);
    }
  }
  return dias;
}

function acumularDiaPorEstado(
  acumulador: DiaAsistenciaSemana,
  estado: string,
  minutosTardanza: number
): void {
  if (ESTADOS_EXCLUIDOS.has(estado)) {
    return;
  }

  acumulador.esperados += 1;

  if (estado === 'ASISTENCIA_REGISTRADA') {
    if (minutosTardanza > 0) {
      acumulador.tardanzas += 1;
    } else {
      acumulador.puntuales += 1;
    }
    return;
  }

  if (estado === 'FALTA_INJUSTIFICADA') {
    acumulador.faltas += 1;
    return;
  }

  if (ESTADOS_JUSTIFICADAS.has(estado)) {
    acumulador.justificadas += 1;
    return;
  }

  acumulador.pendientes += 1;
}

/**
 * Consolida los conteos diarios de asistencia de la semana laboral a partir de las filas `incidencias_mes`.
 * Ignora días sin cálculo aplicable (`FUERA_DE_VINCULO`, `DESCANSO_SEMANAL`,
 * `FERIADO_O_DESCANSO_ACORDADO` y `NO_EVALUADO`) para no distorsionar `esperados`, `pendientes` ni la puntualidad.
 *
 * @param fechasVisibles - Fechas de lunes a viernes que no superan la fecha de corte (`YYYY-MM-DD`).
 * @param desde - Lunes de la semana (`YYYY-MM-DD`).
 * @param hasta - Viernes de la semana (`YYYY-MM-DD`).
 * @param filas - Filas de `incidencias_mes` para los períodos tocados por la semana.
 * @returns Bloque `asistencia_semana` ajustado al contrato del dashboard.
 */
export function construirAsistenciaSemana(
  fechasVisibles: string[],
  desde: string,
  hasta: string,
  filas: FilaIncidenciaSemana[]
): AsistenciaSemanaDashboard {
  const diasPorFecha = new Map<string, DiaAsistenciaSemana>();
  for (const fecha of fechasVisibles) {
    diasPorFecha.set(fecha, {
      fecha,
      esperados: 0,
      puntuales: 0,
      tardanzas: 0,
      faltas: 0,
      justificadas: 0,
      pendientes: 0,
    });
  }

  let ultimaActualizacionMs: number | null = null;
  let diasEmpleadoSinJornada = 0;

  for (const fila of filas) {
    const tiempoFila = fila.actualizado_en.getTime();
    if (
      Number.isFinite(tiempoFila) &&
      (ultimaActualizacionMs === null || tiempoFila > ultimaActualizacionMs)
    ) {
      ultimaActualizacionMs = tiempoFila;
    }

    const diasDetalle = extraerDiasDetalle(fila.detalle);
    for (const dia of diasDetalle) {
      const acumulador = diasPorFecha.get(dia.fecha);
      if (!acumulador) {
        continue;
      }

      if (dia.alertas.includes(ALERTA_SIN_JORNADA)) {
        diasEmpleadoSinJornada += 1;
      }

      acumularDiaPorEstado(acumulador, dia.estado, dia.minutos_tardanza);
    }
  }

  const dias = Array.from(diasPorFecha.values());
  const totalEsperados = dias.reduce((acc, d) => acc + d.esperados, 0);
  const totalPuntuales = dias.reduce((acc, d) => acc + d.puntuales, 0);

  return {
    desde,
    hasta,
    dias,
    puntualidad_porcentaje:
      totalEsperados > 0
        ? redondearDosDecimales((totalPuntuales / totalEsperados) * 100)
        : null,
    fuente: 'INCIDENCIAS_CALCULADAS',
    ultima_actualizacion:
      ultimaActualizacionMs !== null
        ? new Date(ultimaActualizacionMs).toISOString()
        : null,
    dias_empleado_sin_jornada: diasEmpleadoSinJornada,
  };
}
