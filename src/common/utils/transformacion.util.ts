//src/comment/utils/transformacion.util.ts
/**
 * Utilidad para las transformaciones de fechas, horas y textos en la aplicacion.
 */
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

//la libreria dayjs extiende sus funcionalidades con los plugins que se le agregan
//para poder tener acceso a las zonas horarias y a los formatos de fecha personalizados
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const FORMATOS_ACEPTADOS = [
    'YYYY-MM-DD',
    'DD/MM/YYYY',
    'DD-MM-YYYY',
    'YYYY/MM/DD',
    'YYYY-MM-DDTHH:mm:ss.SSSZ'
];

/**
 * Sanitiza un valor de fecha, hora o texto y lo convierte a un objeto Date válido.
 * @param valor - El valor a sanitizar, puede ser un string, un objeto Date o null/undefined.
 * @returns Un objeto Date válido si el valor es una fecha válida, null si el valor es null o un string vacío, o undefined si el valor es undefined.
 */
export function sanitizarFecha(valor?: string | Date | null): Date | null | undefined {
    //si el valor es undefined o null, se retorna undefined o null respectivamente
    if(valor === undefined) return undefined;
    if(valor === null || valor === '') return null;

    //si el valor es una instancia de Date, se valida si es una fecha válida y se retorna la fecha o null
    if(valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;

    //si el valor es un string, se intenta parsear la fecha con los formatos aceptados
    const str = String(valor).trim();
    const parsed = dayjs(str, FORMATOS_ACEPTADOS, true);

    if(parsed.isValid()) return parsed.toDate();
    
    //Fallback para string ISO generales
    const fallback = dayjs(str);
    return fallback.isValid() ? fallback.toDate() : null;
}

/**
 * Sanitiza un valor de texto y lo convierte a un string válido.
 * @param valor - El valor a sanitizar, puede ser un string, null o undefined.
 * @returns Un string válido si el valor es un string no vacío, null si el valor es null o un string vacío, o undefined si el valor es undefined.
 */
export function sanitizarTexto(valor?: string | null): string | null | undefined {
    //si el valor es undefined o null, se retorna undefined o null respectivamente
    if (valor === undefined) return undefined;
    if (valor === null) return null;

    //si el valor es un string, se elimina los espacios en blanco al inicio y al final y se valida si es un string no vacío
    const limpio = valor.trim();
    return limpio.length > 0 ? limpio : null;
}

/**
 * Normaliza un texto para su uso en búsquedas, eliminando acentos, caracteres especiales y convirtiendo a minúsculas.
 * @param texto - El texto a normalizar.
 * @returns El texto normalizado.
 */
export function normalizarParaBusqueda(texto: string): string {
    return texto
        .normalize('NFD') // Normaliza el texto a su forma canónica
        .replace(/[\u0300-\u036f]/g, '') // Elimina los acentos y diacríticos
        .toLowerCase() // Convierte a minúsculas
        .replace(/[^a-z0-9\s]/g, ''); // Elimina caracteres especiales
}