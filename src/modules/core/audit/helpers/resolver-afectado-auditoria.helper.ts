//src/modules/core/audit/helpers/resolver-afectado-auditoria.helper.ts
import {
  TABLAS_AUDITORIA,
  type TipoAfectadoAuditoria,
} from '../config/auditoria-tablas.config';

/** Entidad de negocio a la que se atribuye un cambio auditado. `id` es `null` para la empresa. */
export interface AfectadoAuditoria {
  tipo: TipoAfectadoAuditoria;
  id: string | null;
}

/**
 * Resultado de leer el afectado sin consultar la base. Si la tabla apunta a un derechohabiente,
 * `derechohabienteId` trae el dato que falta para llegar al empleado.
 */
export interface AfectadoExtraidoAuditoria extends AfectadoAuditoria {
  derechohabienteId?: string;
}

/** Busca el empleado dueño de un derechohabiente; `null` si el derechohabiente ya no existe. */
export type BuscarEmpleadoDeDerechohabiente = (
  derechohabienteId: string
) => Promise<string | null>;

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esOperacionMasiva(despues: unknown): boolean {
  return esObjeto(despues) && typeof despues.operacion_masiva === 'string';
}

/**
 * Lista los objetos donde puede estar el campo del afectado. Las operaciones masivas guardan la
 * fila en `datos` (uno o varios) y el criterio en `filtro`.
 */
function listarFuentes(
  antes: unknown,
  despues: unknown
): Record<string, unknown>[] {
  if (esObjeto(despues) && esOperacionMasiva(despues)) {
    const datos: unknown[] = Array.isArray(despues.datos)
      ? (despues.datos as unknown[])
      : [despues.datos];
    return [...datos, despues.filtro].filter(esObjeto);
  }
  return [despues, antes].filter(esObjeto);
}

/** Lee un campo de texto de las fuentes; si hay varios valores distintos no hay un único afectado. */
function leerCampoUnico(
  fuentes: Record<string, unknown>[],
  campo: string
): string | null {
  const valores = new Set(
    fuentes
      .map((fuente) => fuente[campo])
      .filter(
        (valor): valor is string => typeof valor === 'string' && valor !== ''
      )
  );
  return valores.size === 1 ? [...valores][0] : null;
}

/**
 * Determina el afectado de un cambio a partir de la configuración de su tabla, sin consultar la
 * base de datos.
 *
 * @param tabla - Nombre técnico de la tabla auditada.
 * @param registroId - ID de la fila afectada.
 * @param antes - Valores previos de la fila (`valores_antes`).
 * @param despues - Valores posteriores de la fila (`valores_despues`).
 * @returns El afectado, o `null` si la tabla no está configurada o la fila no trae el dato.
 */
export function extraerAfectadoAuditoria(
  tabla: string,
  registroId: string,
  antes: unknown,
  despues: unknown
): AfectadoExtraidoAuditoria | null {
  const config = TABLAS_AUDITORIA[tabla]?.afectado;
  if (!config) return null;

  if (config.origen === 'propio') {
    //En una operación masiva el registro_id es inventado: no identifica a ningún afectado.
    return esOperacionMasiva(despues)
      ? null
      : { tipo: config.tipo, id: registroId };
  }
  if (config.origen === 'ninguno') return { tipo: config.tipo, id: null };

  const id = leerCampoUnico(listarFuentes(antes, despues), config.campo ?? '');
  if (!id) return null;

  if (config.origen === 'derechohabiente') {
    return { tipo: config.tipo, id: null, derechohabienteId: id };
  }
  return { tipo: config.tipo, id };
}

/**
 * Determina el afectado de un cambio completando, si hace falta, el empleado de un
 * derechohabiente con una consulta extra (`derechohabiente_documentos`).
 *
 * @param tabla - Nombre técnico de la tabla auditada.
 * @param registroId - ID de la fila afectada.
 * @param antes - Valores previos de la fila.
 * @param despues - Valores posteriores de la fila.
 * @param buscarEmpleado - Consulta del empleado de un derechohabiente.
 * @returns El afectado, o `null` si no se puede determinar.
 */
export async function resolverAfectadoAuditoria(
  tabla: string,
  registroId: string,
  antes: unknown,
  despues: unknown,
  buscarEmpleado: BuscarEmpleadoDeDerechohabiente
): Promise<AfectadoAuditoria | null> {
  const extraido = extraerAfectadoAuditoria(tabla, registroId, antes, despues);
  if (!extraido) return null;
  if (!extraido.derechohabienteId) {
    return { tipo: extraido.tipo, id: extraido.id };
  }

  const empleadoId = await buscarEmpleado(extraido.derechohabienteId);
  return empleadoId ? { tipo: extraido.tipo, id: empleadoId } : null;
}
