//src/common/utils/audit-snaphot.util.ts
import { createHmac } from 'node:crypto';
import { CryptoUtil } from './crypto.util';

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
 * Campos protegidos de datos personales y bancarios. En lugar de `[OCULTO]` guardan
 * `[OCULTO:<huella>]`, para que la vista pueda saber que el valor cambió sin conocerlo.
 */
export const CAMPOS_CON_HUELLA_AUDITORIA = new Set([
  'cuspp',
  'nro_cuenta_sueldo',
  'cci_sueldo',
  'nro_cuenta_cts',
  'cci_cts',
]);

const LONGITUD_HUELLA_AUDITORIA = 10;

/**
 * Obtiene el texto sobre el que se calcula la huella. Los datos financieros se guardan cifrados con
 * AES-GCM y un IV aleatorio, así que el mismo número cifrado dos veces da textos distintos: se
 * descifra primero para que la huella dependa del dato y no de cada cifrado. Si no se puede
 * descifrar, se usa el texto tal como está guardado.
 */
function obtenerTextoProtegido(valor: unknown): string {
  if (typeof valor !== 'string') return JSON.stringify(valor);
  try {
    return CryptoUtil.decrypt(valor) ?? valor;
  } catch {
    return valor;
  }
}

/**
 * Calcula la huella de un valor protegido: los primeros hex de un HMAC-SHA256 con un secreto del
 * servidor (`AUDITORIA_HUELLA_SECRETO`). Sin el secreto no se puede comprobar un valor probando
 * candidatos, a diferencia de un hash simple de un número de cuenta.
 *
 * @param campo - Nombre del campo; evita que dos campos con el mismo valor tengan la misma huella.
 * @param valor - Valor protegido.
 * @returns La huella, o `null` si el secreto no está configurado.
 */
export function calcularHuellaAuditoria(campo: string, valor: unknown): string | null {
  const secreto = process.env.AUDITORIA_HUELLA_SECRETO;
  if (!secreto) return null;
  return createHmac('sha256', secreto)
    .update(`${campo}:${obtenerTextoProtegido(valor)}`)
    .digest('hex')
    .slice(0, LONGITUD_HUELLA_AUDITORIA);
}

/**
 * Convierte fechas e instancias de `Prisma.Decimal` a JSON primitivo seguro
 * (evitando el `DataCloneError` de `structuredClone` en Prisma 7) y enmascara credenciales
 * o datos financieros sensibles en la bitácora de auditoría (`AUD-F1` y `AUD-F7`). Los datos
 * bancarios y el CUSPP llevan una huella con secreto del servidor si `AUDITORIA_HUELLA_SECRETO`
 * está definido (AUD-M2).
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
        if (CAMPOS_CON_HUELLA_AUDITORIA.has(key)) {
          const huella = calcularHuellaAuditoria(key, value);
          return huella ? `[OCULTO:${huella}]` : '[OCULTO]';
        }
        return '[OCULTO]';
      }
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }),
  );
}
