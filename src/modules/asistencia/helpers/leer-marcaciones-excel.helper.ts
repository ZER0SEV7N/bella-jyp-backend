import type { MultipartFile } from '@fastify/multipart';
import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { conArchivoBiometrico } from './archivo-biometrico.helper';
import type { ErrorImportacion, FilaImportacion } from './fila-marcacion-excel.helper';
import { CABECERAS, MAX_FILAS, validarFilaMarcacion } from './fila-marcacion-excel.helper';

function procesarFila(fila: ExcelJS.Row, usa1904: boolean, filas: FilaImportacion[], errores: ErrorImportacion[]): void {
    const valores = (fila.values as ExcelJS.CellValue[]).slice(1);
    if (fila.number === 1) {
        if (CABECERAS.some((c, i) => String(valores[i] ?? '').trim() !== c))
            throw new BadRequestException(`Use las columnas ${CABECERAS.join(', ')} en ese orden.`);
        return;
    }
    if (fila.number > MAX_FILAS + 1) throw new BadRequestException(`El archivo admite hasta ${MAX_FILAS} filas.`);
    if (valores.every((v) => v === null || v === undefined || v === '')) return;
    try {
        filas.push(validarFilaMarcacion(fila, usa1904));
    } catch (error) {
        if (errores.length < 100) errores.push({ fila: fila.number, detalle: error instanceof Error ? error.message : 'Fila inválida.' });
    }
}

/** Lee una sola hoja por streaming y acota los errores devueltos por fila. */
export async function leerMarcacionesExcel(archivo: MultipartFile) {
    return conArchivoBiometrico(archivo, async (ruta, usa1904, archivoHash) => {
        const filas: FilaImportacion[] = [],
            errores: ErrorImportacion[] = [];
        const lector = new ExcelJS.stream.xlsx.WorkbookReader(ruta, { sharedStrings: 'cache', worksheets: 'emit', styles: 'ignore', hyperlinks: 'ignore' });
        let hojas = 0;
        for await (const hoja of lector) {
            if (++hojas > 1) throw new BadRequestException('El archivo debe contener una sola hoja.');
            for await (const fila of hoja) procesarFila(fila, usa1904, filas, errores);
        }
        if (!filas.length && !errores.length) throw new BadRequestException('El archivo no contiene marcaciones.');
        const periodos = new Set(filas.map((f) => f.fecha.slice(0, 7)));
        if (periodos.size > 1) throw new BadRequestException('Cada archivo debe contener marcaciones de un solo período.');
        return { filas, errores, archivoHash, periodo: [...periodos][0] ?? null };
    });
}
