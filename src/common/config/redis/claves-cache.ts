// src/common/config/redis/claves-cache.ts
/**
 * Claves y configuración de la caché de indicadores del dashboard de RRHH (Mejora 3 / RNF-02).
 * El dashboard se cachea por período y se invalida cuando cambian la asistencia o las planillas
 * del período; el TTL corto actúa como red de seguridad ante cualquier mutación no cubierta.
 */

/** Prefijo común de las claves de caché del dashboard. */
export const DASHBOARD_CACHE_PREFIJO = 'dashboard:rrhh:';

/** TTL en segundos de la caché del dashboard. */
export const DASHBOARD_CACHE_TTL_SEGUNDOS = 60;

/**
 * Construye la clave de caché del dashboard para un período `YYYY-MM`.
 */
export function claveDashboardCache(periodo: string): string {
  return `${DASHBOARD_CACHE_PREFIJO}${periodo}`;
}

/**
 * Patrón para invalidar todas las entradas de caché del dashboard.
 */
export function patronDashboardCache(): string {
  return `${DASHBOARD_CACHE_PREFIJO}*`;
}
