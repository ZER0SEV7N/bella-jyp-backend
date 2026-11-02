//src/common/utils/audit.snaphot.util.ts

/** 
 * Convierte fechas/Decimal a JSON y oculta credenciales en la bitácora. 
 * @param valor - El valor a convertir.
 * @returns El valor convertido a JSON con las credenciales ocultas.
 */
export function crearSnapshotAuditoria(valor: unknown): unknown {
    const sensibles = new Set(['password', 'password_hash', 'password_confirmacion', 'token_hash', 'accessToken', 'refreshToken', 'newRefreshToken']);
    return JSON.parse(JSON.stringify(valor, (key, value) => sensibles.has(key) ? '[OCULTO]' : value));
}
