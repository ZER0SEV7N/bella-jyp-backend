//src/modules/core/audit/helpers/ocultar-huellas-auditoria.helper.ts
const PATRON_HUELLA = /^\[OCULTO:[0-9a-f]+\]$/;

/**
 * Reemplaza cualquier `[OCULTO:<huella>]` por `[OCULTO]` a cualquier profundidad, para que las
 * respuestas con valores crudos (como `/logs/:id`) no muestren la huella de los campos protegidos.
 * No modifica el valor recibido.
 *
 * @param valor - Valores antes o después tal como están guardados en `audit_log`.
 * @returns Una copia sin huellas.
 */
export function ocultarHuellasAuditoria<T>(valor: T): T {
  if (typeof valor === 'string') {
    return (PATRON_HUELLA.test(valor) ? '[OCULTO]' : valor) as T;
  }
  if (Array.isArray(valor)) {
    return valor.map((elemento) =>
      ocultarHuellasAuditoria<unknown>(elemento)
    ) as T;
  }
  if (typeof valor === 'object' && valor !== null && !(valor instanceof Date)) {
    return Object.fromEntries(
      Object.entries(valor).map(([clave, elemento]) => [
        clave,
        ocultarHuellasAuditoria<unknown>(elemento),
      ])
    ) as T;
  }
  return valor;
}
