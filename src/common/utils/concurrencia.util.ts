// src/common/utils/concurrencia.util.ts

/**
 * Ejecuta `fn` sobre cada elemento manteniendo como máximo `limite` promesas en vuelo.
 * Reutilizable por cualquier procesamiento por lotes (cálculo de planillas, carga masiva) sin
 * dependencias externas y preservando el orden de salida.
 * @param items - Elementos a procesar.
 * @param limite - Máximo de operaciones concurrentes.
 * @param fn - Función asíncrona aplicada a cada elemento.
 * @returns - Resultados en el mismo orden que `items`.
 */
export async function mapConLimite<T, R>(
  items: T[],
  limite: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const resultados = new Array<R>(items.length);
  let siguiente = 0;

  const trabajadores = Array.from(
    { length: Math.max(1, Math.min(limite, items.length)) },
    async () => {
      while (siguiente < items.length) {
        const indice = siguiente++;
        resultados[indice] = await fn(items[indice]);
      }
    }
  );

  await Promise.all(trabajadores);
  return resultados;
}
