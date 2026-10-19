import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { CABECERAS } from '../../helpers/fila-marcacion-excel.helper';

@Injectable()
export class DescargarPlantillaMarcacionesUseCase {
    /** La plantilla usa texto para preservar ceros del documento y las fechas locales del biométrico. */
    async execute(): Promise<Buffer> {
        const libro = new ExcelJS.Workbook();
        const hoja = libro.addWorksheet('Marcaciones');
        hoja.addRow(CABECERAS);
        hoja.columns = CABECERAS.map((nombre) => ({ header: nombre, key: nombre, width: 24, style: { numFmt: '@' } }));
        hoja.getRow(1).font = { bold: true };
        hoja.addRow(['00000000', '2026-09-01', '09:00:00', 'ENTRADA']);
        hoja.addRow(['00000000', '2026-09-01', '18:00:00', 'SALIDA']);
        return Buffer.from(await libro.xlsx.writeBuffer());
    }
}
