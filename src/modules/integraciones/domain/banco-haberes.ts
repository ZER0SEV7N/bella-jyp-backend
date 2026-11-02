//src/modules/integraciones/domain/banco-haberes.ts
import Decimal from 'decimal.js';
import type { ConfiguracionExportacionDto, FilaExportacionDto } from '@jyp/shared-contracts';
import { importeDos, numeroFijo, textoFijo, tipoDocumento } from './campos-formato';

/**
 * Funciones de dominio que formatean las estructuras de texto plano de haberes bancarios (Telecrédito BCP)
 * garantizando longitudes fijas (cabecera de 113 caracteres y detalle de 195 caracteres) y suma de control.
 */

function textoBanco(valor: string, longitud: number): string {
    // Normaliza el texto eliminando acentos y convirtiendo a mayúsculas, luego verifica que solo contenga caracteres permitidos.
    const normalizado = valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    
    // Verifica que el texto normalizado solo contenga caracteres permitidos por la estructura de haberes BCP.
    if (!/^[A-Z0-9 .()#/@&-]+$/.test(normalizado))
        throw new RangeError('BCP: texto no admitido por la estructura de haberes.');
    return textoFijo(normalizado, longitud);
}

/**
 * Valida y retorna la cuenta de abono para un empleado específico según la configuración de exportación.
 * @param fila - Objeto que representa la fila de exportación con información del empleado y su cuenta.
 * @param configuracion - Objeto que contiene la configuración de exportación, incluyendo los tipos de cuenta por empleado.
 * @returns Un objeto con el tipo de cuenta y la cuenta de abono correspondiente.
 * @throws RangeError si no se encuentra el tipo de cuenta para el empleado o si la cuenta no cumple con los requisitos de longitud y formato.
 */
export function cuentaAbono(fila: FilaExportacionDto, configuracion: ConfiguracionExportacionDto) {
    // Obtiene el tipo de cuenta de abono para el empleado desde la configuración, verificando que exista.
    const tipo = configuracion.tipos_cuenta_abono?.[fila.empleado_id];
    
    // Si no se encuentra el tipo de cuenta para el empleado, lanza un error indicando que se debe declarar el tipo de cuenta.
    if (!tipo)
        throw new RangeError('Declare el tipo de cuenta de abono por empleado; SUELDO no identifica A/C/M/B.');

    // Determina la longitud requerida de la cuenta según el tipo de cuenta (B, A o M) y valida que la cuenta cumpla con los requisitos de formato.
    const cuenta = tipo === 'B' ? fila.cci : fila.cuenta;
    let longitud = 13;

    // Si el tipo de cuenta es 'B', la longitud requerida es 20; si es 'A', la longitud requerida es 14.
    if (tipo === 'B') longitud = 20;
    else if (tipo === 'A') longitud = 14;

    // Valida que la cuenta exista y cumpla con la longitud requerida, lanzando un error si no es así.
    if (!cuenta || !new RegExp(`^\\d{${longitud}}$`).test(cuenta))
        throw new RangeError(`La cuenta ${tipo} debe contener exactamente ${longitud} dígitos.`);
    return { tipo, cuenta };
}

/**
 * Genera la línea de cabecera del archivo de haberes bancarios para BCP, asegurando que todos los campos cumplan con los requisitos de formato y longitud.
 * @param configuracion - Objeto que contiene la configuración de exportación, incluyendo la cuenta de cargo, tipo de cuenta, fecha de pago y referencia.
 * @param cantidad - Número total de abonos que se incluirán en el archivo.
 * @param total - Monto total de los abonos, formateado como cadena de texto.
 * @param controlAbonos - Suma de control de los abonos, utilizada para verificar la integridad del archivo.
 * @returns Una cadena de texto que representa la línea de cabecera del archivo de haberes bancarios, con una longitud fija de 113 caracteres.
 * @throws RangeError si faltan datos requeridos en la configuración, si la cantidad de abonos es inválida o si el total excede el ancho permitido por BCP.
 */
export function cabeceraBanco(configuracion: ConfiguracionExportacionDto, cantidad: number, total: string, controlAbonos: bigint,): string {
    // Desestructura los campos necesarios de la configuración y valida que todos los datos requeridos estén presentes y sean válidos.
    const {
        cuenta_cargo: cargo,
        tipo_cuenta_cargo: tipo,
        fecha_pago: fecha,
        referencia,
    } = configuracion;

    // Valida que los campos requeridos estén presentes y cumplan con los formatos esperados, lanzando errores si no es así.
    if (!cargo || !/^\d{13}$/.test(cargo) || !tipo || !fecha || !referencia)
        throw new RangeError('Faltan datos de la cabecera BCP.');

    // Valida que la cantidad de abonos sea un número entero seguro y mayor o igual a 1, lanzando un error si no es así.
    if (!Number.isSafeInteger(cantidad) || cantidad < 1)
        throw new RangeError('BCP requiere al menos un abono.');

    // Calcula el control total sumando el control de abonos y el valor del cargo, asegurando que el monto total cumpla con los requisitos de longitud y formato.
    const control = controlAbonos + BigInt(cargo.slice(3));
    const monto = importeDos(total).padStart(17, '0');

    // Valida que el monto total cumpla con la longitud requerida por BCP, lanzando un error si no es así.
    if (monto.length !== 17)
        throw new RangeError('El total excede el ancho admitido por BCP.');
    
    // Construye la línea de cabecera concatenando los campos formateados y asegurando que la longitud total sea de 113 caracteres.
    const linea =
        '1' +
        numeroFijo(String(cantidad), 6) +
        fecha.replace(/-/g, '') +
        'X' +
        tipo +
        '0001' +
        textoFijo(cargo, 20) +
        monto +
        textoBanco(referencia, 40) +
        numeroFijo(control.toString(), 15);
    if (linea.length !== 113)
        throw new RangeError('La cabecera BCP no tiene 113 posiciones.');
    return linea;
}

// Alias de compatibilidad con el ejecutor de tareas n8n (`n8n/tareas/exportar.cjs`).
export const cabeceraBcp = cabeceraBanco;

export function detalleBcp(
    fila: FilaExportacionDto,
    configuracion: ConfiguracionExportacionDto,
) {
    const abono = cuentaAbono(fila, configuracion);
    if (abono.cuenta === configuracion.cuenta_cargo)
        throw new RangeError('La cuenta de cargo y abono no pueden coincidir.');
    const documento = fila.cabecera.nro_documento;
    if (!/^[a-zA-Z0-9]{1,12}$/.test(documento))
        throw new RangeError('El documento BCP debe ser alfanumérico y tener hasta 12 posiciones.');
    const monto = importeDos(fila.resultado.neto_a_pagar).padStart(17, '0');
    if (monto.length !== 17 || new Decimal(monto).isZero())
        throw new RangeError('El abono debe ser positivo y caber en 17 posiciones.');
    const linea =
        '2' +
        abono.tipo +
        textoFijo(abono.cuenta, 20) +
        tipoDocumento(fila.tipo_documento, 'BCP') +
        textoFijo(documento, 12) +
        '   ' +
        textoBanco(fila.cabecera.nombre_completo, 75) +
        textoBanco('ABONO HABERES', 40) +
        textoBanco('PLANILLA', 20) +
        '0001' +
        monto +
        'S';
    if (linea.length !== 195)
        throw new RangeError('El abono BCP no tiene 195 posiciones.');
    return {
        linea,
        importe: importeDos(fila.resultado.neto_a_pagar),
        control: BigInt(abono.cuenta.slice(abono.tipo === 'B' ? 10 : 3)),
    };
}
