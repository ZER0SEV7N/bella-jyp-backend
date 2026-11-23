//src/common/utils/campos-relacion.util.ts
import { Prisma } from '@prisma/client';

/**
 * Campos de relación de cada modelo, obtenidos de `Prisma.dmmf.datamodel` (el modelo de datos que
 * el cliente generado de Prisma 7 expone en tiempo de ejecución, sin consultar la base de datos).
 * Un campo de relación es el que tiene `kind === 'object'`; las columnas `Json` y los enums son
 * `scalar` y `enum`, por lo que no se ven afectados.
 */
const CACHE_CAMPOS_RELACION = new Map<string, ReadonlySet<string>>();
const SIN_RELACIONES: ReadonlySet<string> = new Set();

/**
 * Obtiene los nombres de los campos de relación de un modelo (por ejemplo `area` y `cargo` en
 * `empleados`). Si el modelo de datos no está disponible o el modelo no existe, devuelve un
 * conjunto vacío para que la auditoría siga funcionando.
 *
 * @param modelo - Nombre del modelo de Prisma, igual al de la tabla.
 * @returns Los nombres de los campos de relación.
 */
export function obtenerCamposRelacion(modelo: string): ReadonlySet<string> {
  const guardado = CACHE_CAMPOS_RELACION.get(modelo);
  if (guardado) return guardado;

  const campos = Prisma?.dmmf?.datamodel?.models
    ?.find((m) => m.name === modelo)
    ?.fields.filter((campo) => campo.kind === 'object')
    .map((campo) => campo.name);
  if (!campos) return SIN_RELACIONES;

  const conjunto: ReadonlySet<string> = new Set(campos);
  CACHE_CAMPOS_RELACION.set(modelo, conjunto);
  return conjunto;
}

function esFila(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Devuelve una copia superficial de una fila sin sus campos de relación. No modifica el original.
 *
 * @param modelo - Nombre del modelo de Prisma.
 * @param fila - Fila tal como la devuelve Prisma (puede traer relaciones por `include`).
 * @returns La fila solo con columnas propias; cualquier otro valor se devuelve igual.
 */
export function quitarCamposRelacion<T>(modelo: string, fila: T): T {
  const relaciones = obtenerCamposRelacion(modelo);
  if (relaciones.size === 0 || !esFila(fila)) return fila;
  return Object.fromEntries(
    Object.entries(fila).filter(([campo]) => !relaciones.has(campo))
  ) as T;
}

/**
 * Quita los campos de relación de los `datos` de una operación masiva (`connect`, `create`...),
 * que puede ser una fila o un arreglo de filas.
 *
 * @param modelo - Nombre del modelo de Prisma.
 * @param datos - Valor de `data` de la operación.
 * @returns Los datos con solo columnas propias.
 */
export function quitarCamposRelacionDatos<T>(modelo: string, datos: T): T {
  if (Array.isArray(datos)) {
    return datos.map((fila: unknown) =>
      quitarCamposRelacion(modelo, fila)
    ) as T;
  }
  return quitarCamposRelacion(modelo, datos);
}
