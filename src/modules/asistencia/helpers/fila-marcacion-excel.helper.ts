import { ServerTime } from '@/common/utils/server-time';
import type { FilaMarcacionBiometricaDto } from '@jyp/shared-contracts';
import { FilaMarcacionBiometricaSchema } from '@jyp/shared-contracts';
import type { CellValue, Row } from 'exceljs';

export interface FilaImportacion extends FilaMarcacionBiometricaDto {
    fila: number;
}
export interface ErrorImportacion {
    fila: number;
    detalle: string;
}
export const CABECERAS = ['nro_documento', 'fecha', 'hora', 'tipo_marcacion'];
export const MAX_FILAS = 5000;

export function fechaExcel(serial: number, usa1904: boolean): string {
    if (!Number.isInteger(serial) || serial < (usa1904 ? 0 : 1) || (!usa1904 && serial === 60)) throw new Error('La fecha Excel no es válida.');
    const base = Date.UTC(usa1904 ? 1904 : 1899, usa1904 ? 0 : 11, usa1904 ? 1 : 30);
    //Excel inventa el 29/02/1900: antes de ese día su serie necesita un ajuste adicional.
    const dias = !usa1904 && serial < 60 ? serial + 1 : serial;
    return new Date(base + dias * 86400000).toISOString().slice(0, 10);
}

export function horaExcel(fraccion: number): string {
    if (fraccion < 0 || fraccion >= 1) throw new Error('La hora Excel debe ser una fracción de día.');
    const segundos = Math.round(fraccion * 86400);
    if (segundos >= 86400) throw new Error('La hora excede el día.');
    return `${String(Math.floor(segundos / 3600)).padStart(2, '0')}:${String(Math.floor(segundos / 60) % 60).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
}

/** Convierte una fila y conserva la validación compartida como contrato de entrada. */
export function validarFilaMarcacion(fila: Row, usa1904: boolean): FilaImportacion {
    const valores = (fila.values as CellValue[]).slice(1);
    if (typeof valores[0] !== 'string') throw new Error('El documento debe estar almacenado como texto para preservar sus ceros iniciales.');
    const fecha = typeof valores[1] === 'number' ? fechaExcel(valores[1], usa1904) : String(valores[1] ?? '').trim();
    const hora = typeof valores[2] === 'number' ? horaExcel(valores[2]) : String(valores[2] ?? '').trim();
    const validado = FilaMarcacionBiometricaSchema.parse({
        nro_documento: valores[0],
        fecha,
        hora,
        tipo_marcacion: String(valores[3] ?? '')
            .trim()
            .toUpperCase()
    });
    if (ServerTime.desdeHoraPeru(fecha, hora) > new Date()) throw new Error('La marcación pertenece al futuro.');
    return { ...validado, fila: fila.number };
}
