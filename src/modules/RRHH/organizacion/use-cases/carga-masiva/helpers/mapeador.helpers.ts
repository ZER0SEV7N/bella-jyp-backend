//src/modules/RRHH/organizacion/use-cases/carga-masiva/helpers/mapeador.helpers.ts
import csvParser from "csv-parser";
import * as ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { normalizarLlaveHeader } from "./normalizaciones.helper";

/**
 * Esta clase es un helper que contiene funciones para mapear y normalizar datos de archivos CSV y Excel.
 * Proporciona métodos para convertir filas crudas de datos en objetos con llaves normalizadas y valores procesados.
 * También incluye funciones para manejar buffers de archivos y extraer su contenido de manera estructurada.
 */

/**
 * Funcion para mapear las filas de un archivo CSV a un arreglo de objetos con llaves normalizadas.
 * Obtiene un buffer de archivo CSV, lo convierte en un stream legible y utiliza csv-parser para procesar cada fila.
 * @param filaRaw - La fila cruda del archivo CSV como un objeto con llaves y valores sin procesar.
 * @returns - Un objeto con llaves normalizadas y valores procesados según las reglas definidas en la función.
 */
export function mapearFilaRaw(filaRaw: Record<string, any>): Record<string, any> {
  //Objeto resultante con llaves normalizadas y valores procesados
  let nroDoc = (filaRaw.nro_documento || filaRaw.numero_documento || filaRaw.dni || filaRaw.nro_doc || filaRaw.documento || '').toString().trim();

  //Normalizar el tipo de documento a mayúsculas y eliminar espacios
  const tipoDoc = (filaRaw.tipo_documento || filaRaw.tipo_doc || 'DNI').toString().trim().toUpperCase();

  //Si el número de documento es numérico y tiene menos de la longitud requerida, se rellena con ceros a la izquierda
  if (nroDoc && /^\d+$/.test(nroDoc)) {
    if (tipoDoc === 'DNI' && nroDoc.length < 8) nroDoc = nroDoc.padStart(8, '0');
    if (tipoDoc === 'CE' && nroDoc.length < 9) nroDoc = nroDoc.padStart(9, '0');
  }

  //Normalizar el código de ubigeo a 6 dígitos, rellenando con ceros a la izquierda si es necesario
  let ubigeo = (filaRaw.ubigeo || filaRaw.cod_ubigeo || '').toString().trim();
  if (ubigeo && /^\d+$/.test(ubigeo) && ubigeo.length < 6) 
    ubigeo = ubigeo.padStart(6, '0');
  
  //Normalizar el régimen de pensión, tipo de AFP, tipo de comisión y régimen de salud según las reglas definidas
  const rawRegimen = (filaRaw.regimen_pension || filaRaw.pension || filaRaw.regimen || 'ONP').toString().trim().toUpperCase();
  const regimenPension = rawRegimen.includes('AFP') || rawRegimen.includes('PRIVADO') ? 'AFP' : 'ONP';

  //Normalizar el tipo de AFP según las reglas definidas, buscando coincidencias en el valor crudo
  const rawAfp = (filaRaw.tipo_afp || filaRaw.afp || '').toString().trim().toUpperCase();
  let tipoAfp: string | undefined;
  if (rawAfp.includes('INTEGRA')) tipoAfp = 'INTEGRA';
  else if (rawAfp.includes('PRIMA')) tipoAfp = 'PRIMA';
  else if (rawAfp.includes('HABITAT')) tipoAfp = 'HABITAT';
  else if (rawAfp.includes('PROFUTURO')) tipoAfp = 'PROFUTURO';

  //Normalizar el tipo de comisión según las reglas definidas, buscando coincidencias en el valor crudo
  const rawComision = (filaRaw.tipo_comision || filaRaw.comision || '').toString().trim().toUpperCase();
  const tipoComision = rawComision.includes('MIX') ? 'MIXTA' : rawComision.includes('FLU') ? 'FLUJO' : undefined;

  //Normalizar el régimen de salud según las reglas definidas, buscando coincidencias en el valor crudo
  const rawSalud = (filaRaw.regimen_salud || filaRaw.salud || filaRaw.seguro || 'ESSALUD_REGULAR').toString().trim().toUpperCase();
  const regimenSalud = rawSalud.includes('EPS') ? (rawSalud.includes('ESSALUD') ? 'ESSALUD_Y_EPS' : 'EPS') : 'ESSALUD_REGULAR';

  //Construir el objeto final con todas las llaves normalizadas y valores procesados
  return {
    tipo_documento: tipoDoc,
    nro_documento: nroDoc,
    nombre: (filaRaw.nombre || filaRaw.nombres || '').toString().trim() || undefined,
    apellido: (filaRaw.apellido || filaRaw.apellidos || '').toString().trim() || undefined,
    sexo: (filaRaw.sexo || filaRaw.genero || '').toString().trim() || undefined,
    estado_civil: (filaRaw.estado_civil || filaRaw.civil || '').toString().trim() || undefined,
    fecha_nacimiento: (filaRaw.fecha_nacimiento || filaRaw.fec_nac || '').toString().trim() || undefined,

    email: (filaRaw.email || filaRaw.correo || '').toString().trim() || undefined,
    telefono: (filaRaw.telefono || filaRaw.celular || filaRaw.movil || '').toString().trim() || undefined,
    direccion: (filaRaw.direccion || filaRaw.domicilio || filaRaw.residencia || '').toString().trim(),
    departamento: (filaRaw.departamento || filaRaw.dep || '').toString().trim(),
    provincia: (filaRaw.provincia || filaRaw.prov || '').toString().trim(),
    distrito: (filaRaw.distrito || filaRaw.dist || '').toString().trim(),
    ubigeo: ubigeo || undefined,

    fecha_inicio: (filaRaw.fecha_inicio || filaRaw.fec_ingreso || filaRaw.fecha_ingreso || '').toString().trim(),
    asig_familiar: filaRaw.asig_familiar,
    area: (filaRaw.area || filaRaw.departamento_empresa || filaRaw.seccion || '').toString().trim(),
    cargo: (filaRaw.cargo || filaRaw.puesto || '').toString().trim(),
    jornada: (filaRaw.jornada || filaRaw.turno || filaRaw.horario || '').toString().trim() || undefined,

    sueldo_basico: filaRaw.sueldo_basico || filaRaw.sueldo || filaRaw.salario || 1130.0,
    regimen_pension: regimenPension,
    tipo_afp: tipoAfp,
    cuspp: (filaRaw.cuspp || filaRaw.codigo_afp || '').toString().trim() || undefined,
    tipo_comision: tipoComision,

    banco_sueldo: (filaRaw.banco_sueldo || filaRaw.banco || '').toString().trim() || undefined,
    tipo_cuenta_sueldo: (filaRaw.tipo_cuenta_sueldo || filaRaw.tipo_cuenta || 'SUELDO').toString().trim().toUpperCase(),
    nro_cuenta_sueldo: (filaRaw.nro_cuenta_sueldo || filaRaw.cuenta_sueldo || filaRaw.cuenta_bancaria || '').toString().trim() || undefined,
    cci_sueldo: (filaRaw.cci_sueldo || filaRaw.cci || '').toString().trim() || undefined,

    banco_cts: (filaRaw.banco_cts || '').toString().trim() || undefined,
    tipo_cuenta_cts: (filaRaw.tipo_cuenta_cts || 'AHORROS').toString().trim().toUpperCase(),
    nro_cuenta_cts: (filaRaw.nro_cuenta_cts || filaRaw.cuenta_cts || '').toString().trim() || undefined,
    cci_cts: (filaRaw.cci_cts || '').toString().trim() || undefined,

    regimen_salud: regimenSalud,
    eps_costo_adicional: filaRaw.eps_costo_adicional || filaRaw.costo_eps || 0,
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
    if (valor.result !== undefined) return valor.result;
    if (valor.text !== undefined) return valor.text;
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

  if (typeof valor === 'string' || typeof valor === 'number'|| typeof valor === 'boolean') 
    return String(valor);

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