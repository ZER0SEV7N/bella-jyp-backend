//src/modules/RRHH/organizacion/use-cases/carga-masiva/helpers/cargaMasiva.helpers.ts
//Helpers para la carga masiva de empleados en el módulo de RRHH
//Contiene funciones de normalizacion de texto, fecha de nacimiento y llaves de headers para la carga masiva de empleados
import csvParser from "csv-parser";
import * as ExcelJS from "exceljs";
import { Readable } from "node:stream";

/**
 * Normaliza cadenas de texto removiendo tildes y diacríticos para búsquedas tolerantes.
 */
export function NormalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Metodo que parsea cadenas de fecha en formatos YYYY-MM-DD o DD/MM/YYYY a objetos Date.
 */
export function NormalizarFechaNacimiento(valor: any): Date | null {
  if (!valor) return null;

  if (valor instanceof Date && !isNaN(valor.getTime())) 
    return valor;

  const str = String(valor).trim();
  if (!str) return null;

  //Formato DD/MM/YYYY o DD-MM-YYYY
  const regexLatino = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
  const matchLatino = str.match(regexLatino);
  if (matchLatino) {
    const day = parseInt(matchLatino[1], 10);
    const month = parseInt(matchLatino[2], 10) - 1;
    const year = parseInt(matchLatino[3], 10);
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
  }

  //Formato Estándar YYYY-MM-DD
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Normaliza las llaves de los headers de un archivo CSV o Excel para que sean compatibles con el sistema.
 * @param texto - La cadena de texto a normalizar.
 * @returns La cadena normalizada.
 */
export function NormalizarLlaveHeader(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .trim();
}

/**
 * Metodo encargado de extraer y sanitizar los campos de una fila cruda usando alias flexibles.
 * @param filaRaw - La fila cruda a mapear.
 * @returns La fila mapeada y sanitizada.
 */
export function MapearFilaRaw(filaRaw: Record<string, any>): Record<string, any> {
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
  const rawAsig = filaRaw.asig_familiar;
  const asigVal = typeof rawAsig === 'string' ? rawAsig.toLowerCase().trim() : rawAsig;
  const esAsigFamiliar = asigVal === 'true' || asigVal === '1' || asigVal === true || asigVal === 'si' || asigVal === 'V';

  return {
    tipo_documento: tipoDoc,
    nro_documento: nroDoc,
    nombre: nombre || undefined,
    apellido: apellido || undefined,
    area: area || undefined,
    cargo: cargo || undefined,
    jornada: jornada || undefined,
    fecha_nacimiento: fechaNac || undefined,
    asig_familiar: esAsigFamiliar
  };
}

/**
 * Metodo encargado de leer y extraer el contenido de un buffer `.xlsx` usando ExcelJS.
 * @param buffer - El buffer del archivo `.xlsx` a parsear.
 * @returns Un arreglo de objetos representando las filas del archivo.
 */
export async function ParseExcelBuffer(buffer: Buffer): Promise<Record<string, any>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const filas: Record<string, any>[] = [];
  const headers: string[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = row.values as any[];

    if (rowNumber === 1) {
      for (let i = 1; i < values.length; i++) {
        const valStr = values[i] ? String(values[i]).trim() : `col_${i}`;
        headers.push(NormalizarLlaveHeader(valStr));
      }
    } else {
      const filaObj: Record<string, any> = {};
      let tieneDatos = false;

      for (let i = 1; i < values.length; i++) {
        const key = headers[i - 1];
        let val = values[i];

        if (val && typeof val === 'object') {
          if (val instanceof Date) {
            val = val.toISOString().split('T')[0];
          } else if ((val as any).result !== undefined) {
            val = (val as any).result;
          } else if ((val as any).text !== undefined) {
            val = (val as any).text;
          }
        }

        if (key) {
          const cleanVal = typeof val === 'string' ? val.trim() : val;
          filaObj[key] = cleanVal !== undefined && cleanVal !== null ? cleanVal : '';
          if (cleanVal) tieneDatos = true;
        }
      }

      if (tieneDatos) filas.push(filaObj);
    }
  });

  return filas;
}

/**
 * Metodo encargado de parsear el buffer CSV detectando dinámicamente punto y coma (;) o comas (,).
 * @param buffer - El buffer del archivo CSV a parsear.
 * @returns Un arreglo de objetos representando las filas del archivo.
 */
export async function ParseCsvBuffer(buffer: Buffer): Promise<Record<string, any>[]> {
  let textoDecodificado: string;
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    textoDecodificado = utf8Decoder.decode(buffer);
  } catch {
    const winDecoder = new TextDecoder('windows-1252');
    textoDecodificado = winDecoder.decode(buffer);
  }

  const streamDecodificado = Readable.from([textoDecodificado]);
  const filas: Record<string, any>[] = [];

  const parser = streamDecodificado.pipe(
    csvParser({
      separator: ',',
      mapHeaders: ({ header }) => NormalizarLlaveHeader(header),
    }),
  );

  for await (const filaRaw of parser) {
    const rawKeys = Object.keys(filaRaw);
    const filaLimpia: Record<string, any> = {};

    if (rawKeys.length === 1 && rawKeys[0].includes(';')) {
      const headersArr = rawKeys[0].split(';').map((h) => NormalizarLlaveHeader(h));
      const valString = String(Object.values(filaRaw)[0] || '');
      const valuesArr = valString.split(';').map((v) => v.trim());

      headersArr.forEach((h, idx) => {
        filaLimpia[h] = valuesArr[idx] !== undefined ? valuesArr[idx] : '';
      });
    } else {
      for (const [key, val] of Object.entries(filaRaw)) {
        const cleanKey = NormalizarLlaveHeader(key);
        const cleanVal = typeof val === 'string' ? val.trim() : val;
        filaLimpia[cleanKey] = cleanVal;
      }
    }

    filas.push(filaLimpia);
  }

  return filas;
}