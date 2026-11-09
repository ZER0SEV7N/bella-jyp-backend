//src/common/utils/audit-snaphot.util.ts

/**
 * Conjunto de campos sensibles (credenciales, tokens y datos bancarios/previsionales cifrados)
 * que nunca deben almacenarse en texto claro dentro de `audit_log`.
 */
export const CAMPOS_SENSIBLES_AUDITORIA = new Set([
  'password',
  'password_hash',
  'password_confirmacion',
  'nueva_password',
  'token_hash',
  'accessToken',
  'refreshToken',
  'newRefreshToken',
  'cuspp',
  'nro_cuenta_sueldo',
  'cci_sueldo',
  'nro_cuenta_cts',
  'cci_cts',
  'solicitud_cifrada',
]);

/**
 * Convierte fechas e instancias de `Prisma.Decimal` a JSON primitivo seguro
 * (evitando el `DataCloneError` de `structuredClone` en Prisma 7) y enmascara credenciales
 * o datos financieros sensibles en la bitácora de auditoría (`AUD-F1` y `AUD-F7`).
 *
 * @param valor - Fila o estructura de datos antes/después de la operación DML.
 * @returns Instantánea serializable para almacenar en `valores_antes` o `valores_despues`.
 */
export function crearSnapshotAuditoria(valor: unknown): unknown {
  if (valor === undefined || valor === null) {
    return null;
  }

  return JSON.parse(
    JSON.stringify(valor, (key, value) => {
      if (CAMPOS_SENSIBLES_AUDITORIA.has(key) && value !== null && value !== undefined) {
        return '[OCULTO]';
      }
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }),
  );
}
