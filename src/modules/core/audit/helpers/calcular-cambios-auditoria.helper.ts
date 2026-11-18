//src/modules/core/audit/helpers/calcular-cambios-auditoria.helper.ts
import { CAMPOS_SENSIBLES_AUDITORIA } from '@/common/utils/audit-snaphot.util';
import { obtenerCamposRelacion } from '@/common/utils/campos-relacion.util';
import { obtenerEtiquetaCampoAuditoria } from '../config/auditoria-tablas.config';

/** Campos técnicos internos que se omiten al calcular las diferencias legibles para el usuario (AUD-M2). */
const CAMPOS_TECNICOS_IGNORADOS = new Set([
  'id',
  'created_at',
  'updated_at',
  'creado_en',
  'actualizado_en',
  'version',
  'estado_sincronizacion',
  'fuente_hash',
  'password_hash',
  'token_hash',
]);

/** Campos financieros o reservados que se reportan con `protegido: true` sin mostrar su valor bruto (AUD-M2). */
const CAMPOS_PROTEGIDOS_VISTA = new Set([
  'nro_cuenta_sueldo',
  'cci_sueldo',
  'nro_cuenta_cts',
  'cci_cts',
  'cuspp',
]);

export interface CambioCampoAuditoria {
  campo: string;
  etiqueta: string;
  antes: unknown;
  despues: unknown;
  protegido?: boolean;
}

/**
 * Normaliza un valor escalar o fecha ISO para evitar falsos positivos al comparar antes/después (AUD-M2).
 */
function normalizarValorAuditoria(valor: unknown): unknown {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(valor)) {
    return valor.slice(0, 10);
  }
  if (typeof valor === 'object') {
    return JSON.stringify(valor);
  }
  return valor;
}

/**
 * Compara dos valores protegidos sin conocerlos. Los que llevan huella (`[OCULTO:<huella>]`) son
 * distintos si las huellas difieren. `[OCULTO]` sin huella no permite distinguir un valor de otro,
 * así que contra otro `[OCULTO]` o contra uno con huella se considera igual: es preferible no
 * mostrar un cambio dudoso que inventarlo. Un valor frente a su ausencia sí es un cambio.
 */
function sonIgualesProtegidos(antes: unknown, despues: unknown): boolean {
  if (antes === despues) return true;
  const ambosOcultos =
    typeof antes === 'string' &&
    typeof despues === 'string' &&
    antes.startsWith('[OCULTO') &&
    despues.startsWith('[OCULTO');
  return ambosOcultos && (antes === '[OCULTO]' || despues === '[OCULTO]');
}

/**
 * Calcula la lista de campos modificados entre `valores_antes` y `valores_despues` (AUD-M2).
 * - Oculta `password_hash` y `token_hash`.
 * - Marca cuentas bancarias, CCI y CUSPP con `protegido: true` y valores `null`.
 * - Traduce IDs de catálogos si se provee el diccionario `nombresCatalogos`.
 * - Si se indica `tabla`, usa las etiquetas de esa tabla en `TABLAS_AUDITORIA` e ignora los
 *   campos de relación del modelo (filas guardadas con `include`).
 *
 * @param antesRaw - Valores previos de la fila.
 * @param despuesRaw - Valores posteriores de la fila.
 * @param nombresCatalogos - Nombre legible de cada ID de catálogo ya resuelto.
 * @param tabla - Tabla de la fila, para usar la etiqueta exacta de cada campo.
 * @returns Los campos que cambiaron, ya normalizados y con su etiqueta.
 */
export function calcularCambiosAuditoria(antesRaw: unknown, despuesRaw: unknown, nombresCatalogos: Record<string, string> = {}, tabla?: string ): CambioCampoAuditoria[] {
  const antes = antesRaw && typeof antesRaw === 'object' && !Array.isArray(antesRaw)
      ? (antesRaw as Record<string, unknown>)
      : {};
  const despues = despuesRaw && typeof despuesRaw === 'object' && !Array.isArray(despuesRaw)
      ? (despuesRaw as Record<string, unknown>)
      : {};

  //Las relaciones traídas por `include` (por ejemplo `area` y `cargo`) no son columnas de la
  //fila: solo aparecían en un lado y se mostraban como un cambio inexistente.
  const relaciones = tabla ? obtenerCamposRelacion(tabla) : new Set<string>();
  const claves = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  const cambios: CambioCampoAuditoria[] = [];

  for (const campo of claves) {
    if (CAMPOS_TECNICOS_IGNORADOS.has(campo) || relaciones.has(campo)) continue;
    if (campo === 'password' || campo === 'password_hash' || campo === 'token_hash') continue;

    const valAntes = normalizarValorAuditoria(antes[campo]);
    const valDespues = normalizarValorAuditoria(despues[campo]);

    const esProtegido =
      CAMPOS_PROTEGIDOS_VISTA.has(campo) || CAMPOS_SENSIBLES_AUDITORIA.has(campo);
    if (esProtegido ? sonIgualesProtegidos(valAntes, valDespues) : valAntes === valDespues) continue;

    const etiqueta = obtenerEtiquetaCampoAuditoria(tabla, campo);

    if (CAMPOS_PROTEGIDOS_VISTA.has(campo) || CAMPOS_SENSIBLES_AUDITORIA.has(campo)) {
      cambios.push({
        campo,
        etiqueta,
        antes: null,
        despues: null,
        protegido: true,
      });
      continue;
    }

    const traducir = (v: unknown) => typeof v === 'string' && nombresCatalogos[v] ? nombresCatalogos[v] : v;

    cambios.push({
      campo,
      etiqueta,
      antes: traducir(valAntes),
      despues: traducir(valDespues),
    });
  }

  return cambios;
}
