//src/modules/RRHH/dashboard/helpers/dashboard-dotacion.helper.ts
import type { DashboardRrhhResponseDto } from '@jyp/shared-contracts';

type AreaDistribucionDto =
  DashboardRrhhResponseDto['dotacion']['distribucion_areas'][number];

/**
 * Datos agregados de colaboradores activos agrupados por área.
 */
export interface GrupoAreaDotacion {
  area_id: string;
  nombre: string;
  total_empleados: number;
}

/**
 * Redondea un número a 2 decimales evitando `-0`.
 *
 * @param valor - Número a redondear.
 * @returns Valor redondeado a 2 decimales.
 */
export function redondearDosDecimales(valor: number): number {
  const redondeado = Math.round(valor * 100) / 100;
  return Object.is(redondeado, -0) ? 0 : redondeado;
}

/**
 * Calcula la tasa de rotación mensual en porcentaje:
 * `ceses ÷ ((activosInicio + activosCierre) / 2) × 100`, redondeado a 2 decimales (0 si el promedio es 0).
 *
 * @param ceses - Cantidad de ceses ocurridos en el mes.
 * @param activosInicio - Colaboradores activos el primer día del mes.
 * @param activosCierre - Colaboradores activos en la fecha de corte del mes.
 * @returns Porcentaje de rotación redondeado a 2 decimales.
 */
export function calcularRotacionPorcentaje(
  ceses: number,
  activosInicio: number,
  activosCierre: number
): number {
  const promedioActivos = (activosInicio + activosCierre) / 2;
  if (promedioActivos <= 0) {
    return 0;
  }
  return redondearDosDecimales((ceses / promedioActivos) * 100);
}

/**
 * Construye la distribución de colaboradores por área ordenada de mayor a menor total.
 *
 * @param grupos - Totales de colaboradores activos por área.
 * @param totalActivos - Total de colaboradores activos en la fecha de corte.
 * @returns Lista ordenada de áreas con al menos un colaborador activo y su porcentaje.
 */
export function construirDistribucionAreas(
  grupos: GrupoAreaDotacion[],
  totalActivos: number
): AreaDistribucionDto[] {
  return grupos
    .filter((grupo) => grupo.total_empleados > 0)
    .map((grupo) => ({
      area_id: grupo.area_id,
      nombre: grupo.nombre,
      total_empleados: grupo.total_empleados,
      porcentaje:
        totalActivos > 0
          ? redondearDosDecimales((grupo.total_empleados / totalActivos) * 100)
          : 0,
    }))
    .sort(
      (a, b) =>
        b.total_empleados - a.total_empleados ||
        a.nombre.localeCompare(b.nombre)
    );
}
