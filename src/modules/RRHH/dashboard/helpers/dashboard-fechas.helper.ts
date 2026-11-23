//src/modules/RRHH/dashboard/helpers/dashboard-fechas.helper.ts
import { UnprocessableEntityException } from '@nestjs/common';
import { ServerTime } from '@/common/utils/server-time';

const MS_POR_DIA = 86_400_000;

/**
 * Contexto temporal calculado en hora de Lima para armar el dashboard de RRHH.
 */
export interface ContextoFechasDashboard {
  periodo: string;
  esMesActual: boolean;
  fechaCorte: string;
  primerDiaMes: string;
  ultimoDiaMes: string;
  periodoAnterior: string;
  primerDiaMesAnterior: string;
  ultimoDiaMesAnterior: string;
  semanaDesde: string;
  semanaHasta: string;
  fechasSemanaVisibles: string[];
  periodosSemana: string[];
  generadoEn: string;
}

/**
 * Rango semanal laboral (lunes a viernes) asociado a la fecha de corte.
 */
export interface SemanaLaboralDashboard {
  desde: string;
  hasta: string;
  fechasVisibles: string[];
  periodos: string[];
}

/**
 * Obtiene el último día del mes (`YYYY-MM-DD`) correspondiente a un período `YYYY-MM`.
 *
 * @param periodo - Período en formato `YYYY-MM`.
 * @returns Fecha del último día del mes en formato `YYYY-MM-DD`.
 */
export function obtenerUltimoDiaMes(periodo: string): string {
  const { year, month } = ServerTime.validarPeriodo(periodo);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/**
 * Calcula el período calendario inmediatamente anterior a uno dado.
 *
 * @param periodo - Período base en formato `YYYY-MM`.
 * @returns Período anterior en formato `YYYY-MM`.
 */
export function obtenerPeriodoAnterior(periodo: string): string {
  const { year, month } = ServerTime.validarPeriodo(periodo);
  const yearAnterior = month === 1 ? year - 1 : year;
  const mesAnterior = month === 1 ? 12 : month - 1;
  return `${String(yearAnterior).padStart(4, '0')}-${String(mesAnterior).padStart(2, '0')}`;
}

/**
 * Suma o resta días calendario sobre una fecha civil `YYYY-MM-DD`.
 *
 * @param fecha - Fecha base en formato `YYYY-MM-DD`.
 * @param dias - Cantidad de días a desplazar (puede ser negativa).
 * @returns Nueva fecha en formato `YYYY-MM-DD`.
 */
export function sumarDiasFechaSimple(fecha: string, dias: number): string {
  const base = ServerTime.desdeFechaSimple(fecha);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/**
 * Calcula la diferencia entera de días calendario entre dos fechas `YYYY-MM-DD`.
 *
 * @param desde - Fecha inicial en formato `YYYY-MM-DD`.
 * @param hasta - Fecha final en formato `YYYY-MM-DD`.
 * @returns Número entero de días desde `desde` hasta `hasta`.
 */
export function diferenciaDiasSimples(desde: string, hasta: string): number {
  const inicio = ServerTime.desdeFechaSimple(desde).getTime();
  const fin = ServerTime.desdeFechaSimple(hasta).getTime();
  return Math.round((fin - inicio) / MS_POR_DIA);
}

/**
 * Calcula la semana de lunes a viernes que contiene a `fechaCorte` y filtra los días hasta esa fecha.
 *
 * @param fechaCorte - Fecha de corte en formato `YYYY-MM-DD`.
 * @returns Límites lunes-viernes, días visibles (`<= fechaCorte`) y períodos `YYYY-MM` que toca.
 */
export function obtenerSemanaLaboral(
  fechaCorte: string
): SemanaLaboralDashboard {
  const fecha = ServerTime.desdeFechaSimple(fechaCorte);
  const diaSemana = fecha.getUTCDay();
  const desplazamientoLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  const desde = sumarDiasFechaSimple(fechaCorte, desplazamientoLunes);
  const hasta = sumarDiasFechaSimple(desde, 4);

  const fechasVisibles: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const dia = sumarDiasFechaSimple(desde, i);
    if (dia <= fechaCorte) {
      fechasVisibles.push(dia);
    }
  }

  const periodos = Array.from(
    new Set(fechasVisibles.map((dia) => dia.slice(0, 7)))
  );

  return {
    desde,
    hasta,
    fechasVisibles,
    periodos,
  };
}

/**
 * Resuelve el período, la fecha de corte, el período anterior y la semana laboral en hora de Lima.
 *
 * @param periodoSolicitado - Período opcional enviado por el cliente (`YYYY-MM`).
 * @param ahora - Instante de referencia (por defecto la hora actual del servidor).
 * @returns Contexto completo de fechas para consultar el dashboard.
 * @throws {UnprocessableEntityException} Si `periodoSolicitado` corresponde a un mes futuro.
 */
export function resolverContextoFechasDashboard(
  periodoSolicitado?: string,
  ahora: Date = ServerTime.obtenerFechaServidor
): ContextoFechasDashboard {
  const hoyLima = ServerTime.fechaPeru(ahora);
  const periodoActual = hoyLima.slice(0, 7);
  const periodo = periodoSolicitado?.trim() || periodoActual;

  ServerTime.validarPeriodo(periodo);

  if (periodo > periodoActual) {
    throw new UnprocessableEntityException({
      title: 'Periodo no disponible',
      detail: 'No se puede consultar un mes futuro.',
      campo: 'periodo',
    });
  }

  const primerDiaMes = `${periodo}-01`;
  const ultimoDiaMes = obtenerUltimoDiaMes(periodo);
  const esMesActual = periodo === periodoActual;
  const fechaCorte = esMesActual ? hoyLima : ultimoDiaMes;

  const periodoAnterior = obtenerPeriodoAnterior(periodo);
  const primerDiaMesAnterior = `${periodoAnterior}-01`;
  const ultimoDiaMesAnterior = obtenerUltimoDiaMes(periodoAnterior);

  const semana = obtenerSemanaLaboral(fechaCorte);

  return {
    periodo,
    esMesActual,
    fechaCorte,
    primerDiaMes,
    ultimoDiaMes,
    periodoAnterior,
    primerDiaMesAnterior,
    ultimoDiaMesAnterior,
    semanaDesde: semana.desde,
    semanaHasta: semana.hasta,
    fechasSemanaVisibles: semana.fechasVisibles,
    periodosSemana: semana.periodos,
    generadoEn: ahora.toISOString(),
  };
}
