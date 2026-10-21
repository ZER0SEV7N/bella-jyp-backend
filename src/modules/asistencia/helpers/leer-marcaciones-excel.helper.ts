//src/modules/asistencia/helpers/leer-marcaciones-excel.helper.ts
import type { MultipartFile } from '@fastify/multipart';
import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { conArchivoBiometrico } from './archivo-biometrico.helper';
import type { ErrorImportacion, FilaImportacion } from './fila-marcacion-excel.helper';
import { CABECERAS, MAX_FILAS, validarFilaMarcacion } from './fila-marcacion-excel.helper';

/**
 * Helper que lee un archivo Excel de marcaciones de asistencia y valida su contenido.
 * Este helper procesa el archivo Excel por streaming, valida las cabeceras, el número de filas y el contenido de cada fila.
 * Devuelve un objeto con las filas válidas, los errores encontrados, el hash del archivo y el período de las marcaciones.
 * @param archivo - El archivo Excel que contiene las marcaciones a leer.
 * @returns - Promesa que se resuelve con un objeto que contiene las filas de marcaciones, los errores encontrados, el hash del archivo y el período de las marcaciones.
 * @throws - Error de tipo BadRequestException si el archivo Excel contiene errores, no se puede procesar o no cumple con las condiciones esperadas.
 */

/**
 * Funcion que procesa una fila del archivo Excel de marcaciones y valida su contenido.
 * Si la fila es la primera, valida que las cabeceras coincidan con las esperadas.
 * Si la fila excede el número máximo permitido, lanza una excepción.
 * Si la fila está vacía, se ignora.
 * Si la fila contiene datos, se valida y se agrega a la lista de filas válidas o se registra un error si es inválida.
 * @param fila - La fila del archivo Excel que se va a procesar.
 * @param usa1904 - Indica si el archivo Excel utiliza el sistema de fechas 1904.
 * @param filas  - Lista de filas válidas que se van a llenar con las filas procesadas.
 * @param errores - Lista de errores que se van a llenar con los errores encontrados durante el procesamiento de las filas.
 * @returns - No retorna ningún valor, pero modifica las listas de filas y errores pasadas como parámetros.
 * @throws - Error de tipo BadRequestException si las cabeceras no coinciden, si se excede el número máximo de filas o si la fila es inválida.
 */
function procesarFila(fila: ExcelJS.Row, usa1904: boolean, filas: FilaImportacion[], errores: ErrorImportacion[]): void {
    //Se obtienen los valores de la fila, omitiendo la primera columna (índice 0) que corresponde al número de fila.
    const valores = (fila.values as ExcelJS.CellValue[]).slice(1);
    
    //Si la fila es la primera (cabecera), 
    //se valida que las cabeceras coincidan con las esperadas. Si no coinciden, se lanza una excepción BadRequestException.
    if (fila.number === 1) {
        if (CABECERAS.some((c, i) => String(valores[i] ?? '').trim() !== c))
            throw new BadRequestException(`Use las columnas ${CABECERAS.join(', ')} en ese orden.`);
        return;
    }
    
    //Si la fila excede el número máximo permitido, lanza una excepción.
    if (fila.number > MAX_FILAS + 1) 
        throw new BadRequestException(`El archivo admite hasta ${MAX_FILAS} filas.`);
    
    //Si la fila está vacía (todos los valores son nulos, indefinidos o cadenas vacías), se ignora.
    if (valores.every((v) => v === null || v === undefined || v === '')) return;

    //Se intenta validar la fila utilizando la función validarFilaMarcacion.
    try {
        filas.push(validarFilaMarcacion(fila, usa1904));
    } catch (error) {
        if (errores.length < 100) errores.push({ fila: fila.number, detalle: error instanceof Error ? error.message : 'Fila inválida.' });
    }
}

/**
 * Lee una sola hoja por streaming y acota los errores devueltos por fila.
 * Valida que el archivo contenga marcaciones de un solo período y que las cabeceras coincidan con las esperadas.
 * @param archivo - El archivo Excel que contiene las marcaciones a leer.
 * @returns - Promesa que se resuelve con un objeto que contiene las filas de marcaciones, los errores encontrados, el hash del archivo y el período de las marcaciones.
 * @throws - Error de tipo BadRequestException si el archivo Excel contiene errores, no se puede procesar o no cumple con las condiciones esperadas.
 */
export async function leerMarcacionesExcel(archivo: MultipartFile) {
    //Se utiliza la función conArchivoBiometrico para manejar el archivo Excel y procesarlo por streaming.
    return conArchivoBiometrico(archivo, async (ruta, usa1904, archivoHash) => {
        //Se inicializan las listas de filas válidas y errores encontrados durante el procesamiento del archivo.
        const filas: FilaImportacion[] = [], errores: ErrorImportacion[] = [];

        //Se crea un lector de archivos Excel utilizando la librería ExcelJS para leer el archivo por streaming.
        const lector = new ExcelJS.stream.xlsx.WorkbookReader(ruta, { sharedStrings: 'cache', worksheets: 'emit', styles: 'ignore', hyperlinks: 'ignore' });
        
        //Se inicializa un contador de hojas procesadas para asegurar que el archivo contenga solo una hoja.
        let hojas = 0;

        //Se recorren las hojas del archivo Excel.
        for await (const hoja of lector) {
            if (++hojas > 1) 
                throw new BadRequestException('El archivo debe contener una sola hoja.');
            for await (const fila of hoja) 
                procesarFila(fila, usa1904, filas, errores);
        }

        //Si no se encontraron filas ni errores, se lanza una excepción indicando que el archivo no contiene marcaciones.
        if (!filas.length && !errores.length) 
            throw new BadRequestException('El archivo no contiene marcaciones.');

        //Se obtiene el conjunto de períodos únicos de las filas procesadas y se valida que todas las marcaciones pertenezcan a un solo período.
        const periodos = new Set(filas.map((f) => f.fecha.slice(0, 7)));
        if (periodos.size > 1) 
            throw new BadRequestException('Cada archivo debe contener marcaciones de un solo período.');

        //Se retorna un objeto que contiene las filas de marcaciones, los errores encontrados, el hash del archivo y el período de las marcaciones.
        return { filas, errores, archivoHash, periodo: [...periodos][0] ?? null };
    });
}
