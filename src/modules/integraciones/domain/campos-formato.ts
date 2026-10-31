//src/modules/integraciones/domain/campos-formato
import Decimal from 'decimal.js';

/**
 * Funcion de dominio que formatea los campos de un archivo de texto plano para cumplir con los requisitos de longitud y formato.
 * @module campos-formato
 */

/**
 * Función que valida y formatea un importe a dos decimales, redondeando hacia arriba si es necesario.
 * @param valor - El valor a validar y formatear, puede ser un número o una cadena que represente un número.
 * @returns Una cadena que representa el importe formateado a dos decimales.
 * @throws RangeError si el valor no es un número o una cadena, si no es finito o si es negativo.
 */
export function importeDos(valor: unknown): string {
    //Validación del tipo de valor
    if (typeof valor !== 'string' && typeof valor !== 'number')
        throw new RangeError('Falta un importe del snapshot.');
    
    //Conversión del valor a Decimal para validación y formateo
    const importe = new Decimal(valor);
    
    //Validación del valor
    if (!importe.isFinite() || importe.isNegative())
        throw new RangeError('El importe debe ser finito y no negativo.');
    
    //Formateo del importe a dos decimales, redondeando hacia arriba si es necesario
    return importe.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/**
 * Función que valida y formatea un texto a una longitud fija, rellenando con espacios si es necesario.
 * @param valor - El texto a validar y formatear.
 * @param longitud - La longitud fija a la que se debe ajustar el texto.
 * @returns - Una cadena que representa el texto formateado a la longitud fija.
 */
export function textoFijo(valor: string, longitud: number): string {
    //Validación de caracteres no representables
    if (/[\r\n|\x00-\x1f]/.test(valor) || [...valor].some((c) => c.charCodeAt(0) > 255))
        throw new RangeError('El texto contiene caracteres no representables en el archivo.');
    
    //Validación de la longitud del texto
    if (valor.length > longitud)
        throw new RangeError(`El valor excede ${longitud} posiciones; no se trunca silenciosamente.`);
    
    //Relleno del texto con espacios hasta alcanzar la longitud fija
    return valor.padEnd(longitud, ' ');
}

/**
 * Función que valida y formatea un número a una longitud fija, rellenando con ceros a la izquierda si es necesario.
 * @param valor - El número a validar y formatear, debe ser una cadena que represente un número entero.
 * @param longitud - La longitud fija a la que se debe ajustar el número.
 * @returns - Una cadena que representa el número formateado a la longitud fija.
 * @throws RangeError si el valor no es un número entero o si excede la longitud especificada.
 */
export function numeroFijo(valor: string, longitud: number): string {
    //Validación de que el valor es un número entero y no excede la longitud especificada
    if (!/^\d+$/.test(valor) || valor.length > longitud)
        throw new RangeError(`El número no cabe en ${longitud} posiciones.`);

    //Relleno del número con ceros a la izquierda hasta alcanzar la longitud fija
    return valor.padStart(longitud, '0');
}

/**
 * Función que obtiene el código correspondiente a un tipo de documento según el destino especificado.
 * @param nombre - El nombre del tipo de documento (por ejemplo, "DNI", "CARNE DE EXTRANJERIA", "PASAPORTE").
 * @param destino - El destino para el cual se requiere el código del tipo de documento ("PLAME", "AFPNET" o "BCP").
 * @returns - Una cadena que representa el código del tipo de documento para el destino especificado.
 * @throws RangeError si el tipo de documento no tiene una equivalencia explícita para el destino especificado.
 */
export function tipoDocumento( nombre: string, destino: 'PLAME' | 'AFPNET' | 'BCP' ): string {
    //Normalización del nombre del tipo de documento para obtener la clave correspondiente
    const clave = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    
    //Definición de los códigos correspondientes a cada tipo de documento para cada destino
    const codigos: Record<string, Record<string, string>> = {
        DNI: { PLAME: '01', AFPNET: '0', BCP: '1' },
        'CARNE DE EXTRANJERIA': { PLAME: '04', AFPNET: '1', BCP: '3' },
        CE: { PLAME: '04', AFPNET: '1', BCP: '3' },
        PASAPORTE: { PLAME: '07', AFPNET: '4', BCP: '4' },
    };

    //Validación de que el tipo de documento tiene una equivalencia explícita para el destino especificado
    if (!codigos[clave])
        throw new RangeError(`El tipo documental ${nombre} requiere una equivalencia explícita para ${destino}.`
    );
    return codigos[clave][destino];
}
