//src/modules/asistencia/helpers/fila-marcacion-excel.helper.ts
import { ServerTime } from '@/common/utils/server-time';
import { BadRequestException } from '@nestjs/common';
import type { FilaMarcacionBiometricaDto } from '@jyp/shared-contracts';
import { FilaMarcacionBiometricaSchema } from '@jyp/shared-contracts';
import type { CellValue, Row } from 'exceljs';

/**
 * Helper que valida y procesa las filas de marcaciones de asistencia leídas desde un archivo Excel.
 * Este helper tiene funciones para convertir fechas y horas de Excel a formato ISO, 
 * validar el contenido de cada fila y devolver un objeto con las filas válidas y los errores encontrados.
 */

//Función que valida una fila de marcación de asistencia leída desde un archivo Excel.
export interface FilaImportacion extends FilaMarcacionBiometricaDto { fila: number; }

//Función que convierte un número de serie de Excel a una fecha en formato ISO (YYYY-MM-DD).
export interface ErrorImportacion {
    fila: number;
    detalle: string;
}

export const CABECERAS = ['nro_documento', 'fecha', 'hora', 'tipo_marcacion']; //Cabeceras esperadas en el archivo Excel de marcaciones de asistencia.
export const MAX_FILAS = 5000; //Número máximo de filas permitidas en el archivo Excel de marcaciones de asistencia.

/**
 * Convierte un número de serie de Excel a una fecha en formato ISO (YYYY-MM-DD).
 * @param serial - Número de serie de Excel que representa una fecha.
 * @param usa1904 - Indica si el archivo Excel utiliza el sistema de fechas 1904.
 * @returns - Fecha en formato ISO (YYYY-MM-DD).
 * @throws - Error si el número de serie no es válido o está fuera del rango permitido.
 */
export function fechaExcel(serial: number, usa1904: boolean): string {
    if (!Number.isInteger(serial) || serial < (usa1904 ? 0 : 1) || (!usa1904 && serial === 60)) 
        throw new BadRequestException('La fecha Excel no es válida.');
    
    //Se calcula la fecha base en milisegundos desde el 1 de enero de 1970, ajustando según el sistema de fechas utilizado (1904 o 1900).
    const base = Date.UTC(usa1904 ? 1904 : 1899, usa1904 ? 0 : 11, usa1904 ? 1 : 30);

    //Excel inventa el 29/02/1900: antes de ese día su serie necesita un ajuste adicional.
    const dias = !usa1904 && serial < 60 ? serial + 1 : serial;
    return new Date(base + dias * 86400000).toISOString().slice(0, 10);
}

/**
 * Funcion que convierte una fracción de día de Excel a una hora en formato HH:MM:SS.
 * @param fraccion - Fracción de día de Excel que representa una hora.
 * @returns - Hora en formato HH:MM:SS.
 * @throws - Error si la fracción no es válida o está fuera del rango permitido.
 */
export function horaExcel(fraccion: number): string {
    //Se valida que la fracción esté en el rango permitido (0 <= fraccion < 1).
    if (fraccion < 0 || fraccion >= 1) 
        throw new BadRequestException('La hora Excel debe ser una fracción de día.');
    
    //Se calcula el número de segundos desde la fracción de día y se convierte a formato HH:MM:SS.
    const segundos = Math.round(fraccion * 86400);
    if (segundos >= 86400) 
        throw new BadRequestException('La hora excede el día.');
    
    //Se retorna la hora en formato HH:MM:SS, asegurándose de que cada componente tenga dos dígitos.
    return `${String(Math.floor(segundos / 3600)).padStart(2, '0')}:${String(Math.floor(segundos / 60) % 60).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
}

/**
 * Función que valida una fila de marcación de asistencia leída desde un archivo Excel.
 * Si la fila es la primera, valida que las cabeceras coincidan con las esperadas.
 * Si la fila excede el número máximo permitido, lanza una excepción.
 * Si la fila está vacía, se ignora.
 * Si la fila contiene datos, se valida y se agrega a la lista de filas válidas o se registra un error si es inválida.
 * @param fila - La fila del archivo Excel que se va a procesar.
 * @param usa1904 - Indica si el archivo Excel utiliza el sistema de fechas 1904.
 * @returns - Objeto que contiene los datos validados de la fila de marcación de asistencia.
 * @throws - Error de tipo BadRequestException si las cabeceras no coinciden, si se excede el número máximo de filas o si la fila es inválida.
 */
export function validarFilaMarcacion(fila: Row, usa1904: boolean): FilaImportacion {
    //Se obtienen los valores de la fila, omitiendo la primera columna (índice 0) que corresponde al número de fila.
    const valores = (fila.values as CellValue[]).slice(1);

    //Si la fila es la primera (cabecera), se valida que las cabeceras coincidan con las esperadas. Si no coinciden, se lanza una excepción BadRequestException.
    if (typeof valores[0] !== 'string') 
        throw new BadRequestException('El documento debe estar almacenado como texto para preservar sus ceros iniciales.');

    //Se valida que la fecha y hora sean válidas y se convierten a formato ISO.
    const fecha = typeof valores[1] === 'number' ? fechaExcel(valores[1], usa1904) : String(valores[1] ?? '').trim();
    const hora = typeof valores[2] === 'number' ? horaExcel(valores[2]) : String(valores[2] ?? '').trim();
    const validado = FilaMarcacionBiometricaSchema.parse({
        nro_documento: valores[0],
        fecha,
        hora,
        tipo_marcacion: String(valores[3] ?? '').trim().toUpperCase()
    });

    //Se valida que la marcación no pertenezca a una fecha futura en relación con la hora actual del servidor.
    if (ServerTime.desdeHoraPeru(fecha, hora) > new Date()) 
        throw new BadRequestException('La marcación pertenece al futuro.');
    return { ...validado, fila: fila.number };
}
