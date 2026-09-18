//src/modules/RRHH/organizacion/use-cases/carga-masiva/helpers/normalizaciones.helper.ts

/**
 * Esta clase es un helper que contiene funciones para normalizar texto, fechas y llaves de headers en el contexto de la carga masiva de empleados.
 * Proporciona métodos para convertir cadenas de texto a un formato estandarizado, parsear fechas y normalizar llaves de headers para que sean compatibles con el sistema.
 * También incluye funciones para manejar buffers de archivos y extraer su contenido de manera estructurada.
 */

/**
 * Metodo que normaliza un texto eliminando acentos, convirtiendo a minúsculas y eliminando caracteres especiales.
 * @param texto - La cadena de texto a normalizar.
 * @returns - La cadena normalizada.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Metodo que normaliza una fecha a un objeto Date válido.
 * Acepta formatos de fecha comunes como DD/MM/YYYY, DD-MM-YYYY y YYYY-MM-DD.
 * @param valor - La fecha a normalizar, puede ser un string o un objeto Date.
 * @returns - Un objeto Date válido o null si la fecha no es válida.
 */
export function normalizarFecha(valor: any): Date | null {
  if (!valor) return null;

  if (valor instanceof Date && !Number.isNaN(valor.getTime()))
    return valor;

  const str = String(valor).trim();
  if (!str) return null;

  //Formato DD/MM/YYYY o DD-MM-YYYY
  const regexLatino = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
  const matchLatino = regexLatino.exec(str);
  if (matchLatino) {
    const day = Number.parseInt(matchLatino[1], 10);
    const month = Number.parseInt(matchLatino[2], 10) - 1;
    const year = Number.parseInt(matchLatino[3], 10);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  //Formato Estándar YYYY-MM-DD
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Normaliza las llaves de los headers de un archivo CSV o Excel para que sean compatibles con el sistema.
 * @param texto - La cadena de texto a normalizar.
 * @returns La cadena normalizada.
 */
export function normalizarLlaveHeader(texto: string): string {
  if (!texto) return '';
  let normalizada = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
     .replace(/[\s\-/()]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+/, '')
    .replace(/__+/g, '_')
    .trim();

  while (normalizada.endsWith('_')) 
    normalizada = normalizada.slice(0, -1);

  return normalizada;
}