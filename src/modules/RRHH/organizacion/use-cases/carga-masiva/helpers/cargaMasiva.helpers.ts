//src/modules/RRHH/organizacion/use-cases/carga-masiva/helpers/cargaMasiva.helpers.ts
//Helpers para la carga masiva de empleados en el módulo de RRHH
//Contiene funciones de normalizacion de texto, fecha de nacimiento y llaves de headers para la carga masiva de empleados
import csvParser from "csv-parser";
import * as ExcelJS from "exceljs";
import { Readable } from "node:stream";

/**
 * Normaliza cadenas de texto removiendo tildes y diacríticos para búsquedas tolerantes.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Metodo que parsea cadenas de fecha en formatos YYYY-MM-DD o DD/MM/YYYY a objetos Date.
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

/**
 * Metodo encargado de extraer y sanitizar los campos de una fila cruda usando alias flexibles.
 * @param filaRaw - La fila cruda a mapear.
 * @returns La fila mapeada y sanitizada.
 */
export function mapearFilaRaw(filaRaw: Record<string, any>): Record<string, any> {
  //Normalizar y mapear campos de la fila
  let nroDoc = (filaRaw.nro_documento || filaRaw.numero_documento || filaRaw.dni || filaRaw.nro_doc || filaRaw.documento || '' ).toString().trim();
  const tipoDoc = (filaRaw.tipo_documento || filaRaw.tipo_doc || 'DNI' ).toString().trim();
  // Auto-padding de ceros a la izquierda si Excel recortó el número
  if (nroDoc && /^\d+$/.test(nroDoc)) {
    if (tipoDoc === 'DNI' && nroDoc.length < 8) {
      nroDoc = nroDoc.padStart(8, '0');
    } else if (tipoDoc === 'CE' && nroDoc.length < 9) {
      nroDoc = nroDoc.padStart(9, '0');
    }
  }
  const nombre = (filaRaw.nombre || filaRaw.nombres || '' ).toString().trim();
  const apellido = (filaRaw.apellido || filaRaw.apellidos || '' ).toString().trim();
  const area = (filaRaw.area || filaRaw.departamento || '').toString().trim();
  const cargo = (filaRaw.cargo || filaRaw.puesto || '' ).toString().trim();
  const jornada = (filaRaw.jornada ||filaRaw.turno ||filaRaw.horario ||'').toString().trim();
  const fechaNac = (filaRaw.fecha_nacimiento || filaRaw.fec_nac || filaRaw.cumpleaños || filaRaw.cumpleanios || '' ).toString().trim();
  const fechaInicio = (filaRaw.fecha_inicio || filaRaw.fec_inicio || filaRaw.fecha_ingreso || filaRaw.fec_ingreso || filaRaw.start_date || '' ).toString().trim();
  const rawAsig = filaRaw.asig_familiar;
  const asigVal = typeof rawAsig === 'string' ? rawAsig.toLowerCase().trim() : rawAsig;
  const esAsigFamiliar = asigVal === 'true' || asigVal === '1' || asigVal === true || asigVal === 'si' || asigVal === 'V' || asigVal === 'v';

  return {
    tipo_documento: tipoDoc,
    nro_documento: nroDoc,
    nombre: nombre || undefined,
    apellido: apellido || undefined,
    area: area || undefined,
    cargo: cargo || undefined,
    jornada: jornada || undefined,
    fecha_nacimiento: fechaNac || undefined,
    fecha_inicio: fechaInicio || undefined,
    asig_familiar: esAsigFamiliar
  };
}

/**
 * Normaliza el valor leido desde una celda de Excel para evitar objetos complejos.
 */
function normalizarValorCeldaExcel(valor: any): any {
  if (valor == null) return '';

  if (valor instanceof Date) 
    return valor.toISOString().split('T')[0];
  

  if (typeof valor === 'object') {
    if ((valor as any).result !== undefined) return (valor as any).result;
    if ((valor as any).text !== undefined) return (valor as any).text;
  }

  return valor;
}

/**
 * Construye los headers de la hoja Excel tomando como referencia la primera fila.
 */
function obtenerHeadersExcel(values: any[]): string[] {
  return values.slice(1).map((valor, index) => {
    const texto = valor ? String(valor).trim() : `col_${index + 1}`;
    return normalizarLlaveHeader(texto);
  });
}

/**
 * Mapea una fila de Excel a un objeto clave-valor usando los headers ya normalizados.
 */
function mapearFilaExcel(values: any[], headers: string[]): Record<string, any> | null {
  const filaObj: Record<string, any> = {};
  let tieneDatos = false;

  for (let i = 1; i < values.length; i++) {
    const key = headers[i - 1];
    const valor = normalizarValorCeldaExcel(values[i]);
    const cleanVal = typeof valor === 'string' ? valor.trim() : valor;

    if (key) {
      filaObj[key] = cleanVal ?? '';
      if (cleanVal) tieneDatos = true;
    }
  }

  return tieneDatos ? filaObj : null;
}

/**
 * Metodo encargado de leer y extraer el contenido de un buffer `.xlsx` usando ExcelJS.
 * @param buffer - El buffer del archivo `.xlsx` a parsear.
 * @returns Un arreglo de objetos representando las filas del archivo.
 */
export async function mapearExcelBuffer(buffer: Buffer): Promise<Record<string, any>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const filas: Record<string, any>[] = [];
  const headers: string[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = row.values as any[];

    if (rowNumber === 1) {
      headers.push(...obtenerHeadersExcel(values));
      return;
    }

    const filaMapeada = mapearFilaExcel(values, headers);
    if (filaMapeada) filas.push(filaMapeada);
  });

  return filas;
}

/**
 * Convierte cualquier valor crudo de una celda CSV a un string representativo.
 */
function normalizarValorCsv(valor: any): string {
  if (valor == null) return '';

  if (
    typeof valor === 'string'
    || typeof valor === 'number'
    || typeof valor === 'boolean'
  ) {
    return String(valor);
  }

  return JSON.stringify(valor);
}

/**
 * Construye una fila limpia normalizando headers y valores del CSV.
 */
function construirFilaLimpia(filaRaw: Record<string, any>): Record<string, any> {
  const rawKeys = Object.keys(filaRaw);
  if (rawKeys.length === 1 && rawKeys[0].includes(';')) {
    const headersArr = rawKeys[0].split(';').map((h) => normalizarLlaveHeader(h));
    const valuesArr = normalizarValorCsv(Object.values(filaRaw)[0]).split(';').map((v) => v.trim());

    return headersArr.reduce<Record<string, any>>((filaLimpia, header, idx) => {
      filaLimpia[header] = valuesArr[idx] ?? '';
      return filaLimpia;
    }, {});
  }

  return Object.entries(filaRaw).reduce<Record<string, any>>((filaLimpia, [key, val]) => {
    const cleanKey = normalizarLlaveHeader(key);
    const cleanVal = typeof val === 'string' ? val.trim() : val;
    filaLimpia[cleanKey] = cleanVal;
    return filaLimpia;
  }, {});
}

/**
 * Metodo encargado de parsear el buffer CSV detectando dinámicamente punto y coma (;) o comas (,).
 * @param buffer - El buffer del archivo CSV a parsear.
 * @returns Un arreglo de objetos representando las filas del archivo.
 */
export async function mapearCsvBuffer(buffer: Buffer): Promise<Record<string, any>[]> {
  const textoDecodificado = (() => {
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      return utf8Decoder.decode(buffer);
    } catch {
      const winDecoder = new TextDecoder('windows-1252');
      return winDecoder.decode(buffer);
    }
  })();

  const streamDecodificado = Readable.from([textoDecodificado]);
  const filas: Record<string, any>[] = [];

  const parser = streamDecodificado.pipe(
    csvParser({
      separator: ',',
      mapHeaders: ({ header }) => normalizarLlaveHeader(header),
    }),
  );

  for await (const filaRaw of parser) 
    filas.push(construirFilaLimpia(filaRaw));

  return filas;
}