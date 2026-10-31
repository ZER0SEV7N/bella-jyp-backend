//src/modules/integraciones/domain/banco-haberes.ts
import Decimal from 'decimal.js';
import type { ConfiguracionExportacionDto, FilaExportacionDto } from '@jyp/shared-contracts';
import { importeDos, numeroFijo, textoFijo, tipoDocumento } from './campos-formato';

/**
 * Funcion de dominio que formatea los campos de un archivo de texto plano para cumplir con los requisitos de longitud y formato.
 * Esto esta pensado para el BANCO COMERCIAL DEL PERU (~B~C~P~) y su estructura de haberes, 
 * que requiere un formato específico para la exportación de datos de planillas.
 * (NOTA: es posible que le quite la siglas debido a que al trabajar para NTTDATA, estos observan que no se revele nada de sus clientes, 
 * por lo que se ha decidido no poner las siglas de la empresa en el código fuente.)
 * (Al momento que este proyecto pase a JYP, se puede cambiar el nombre del archivo a banco-haberes.ts y quitar la referencia al BCP.)
 */

function textoBanco(valor: string, longitud: number): string {
    const normalizado = valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (!/^[A-Z0-9 .()#/@&-]+$/.test(normalizado))
        throw new RangeError(
            'BCP: texto no admitido por la estructura de haberes.'
        );
    return textoFijo(normalizado, longitud);
}

export function cuentaAbono(fila: FilaExportacionDto, configuracion: ConfiguracionExportacionDto) {
    const tipo = configuracion.tipos_cuenta_abono?.[fila.empleado_id];
    if (!tipo)
        throw new RangeError('Declare el tipo de cuenta de abono por empleado; SUELDO no identifica A/C/M/B.');
    const cuenta = tipo === 'B' ? fila.cci : fila.cuenta;
    let longitud = 13;
    if (tipo === 'B') longitud = 20;
    else if (tipo === 'A') longitud = 14;

    //Validación de que la cuenta de abono tiene la longitud correcta según el tipo de cuenta,
    //ya que esto es un requisito del formato de archivo de haberes del BCP
    if (!cuenta || !new RegExp(`^\\d{${longitud}}$`).test(cuenta))
        throw new RangeError(`La cuenta ${tipo} debe contener exactamente ${longitud} dígitos.`);
    return { tipo, cuenta };
}

export function cabeceraBanco(configuracion: ConfiguracionExportacionDto, cantidad: number, total: string, controlAbonos: bigint): string {
    const {
        cuenta_cargo: cargo,
        tipo_cuenta_cargo: tipo,
        fecha_pago: fecha,
        referencia,
    } = configuracion;
    if (!cargo || !/^\d{13}$/.test(cargo) || !tipo || !fecha || !referencia)
        throw new RangeError('Faltan datos de la cabecera BCP.');
    if (!Number.isSafeInteger(cantidad) || cantidad < 1)
        throw new RangeError('BCP requiere al menos un abono.');
    const control = controlAbonos + BigInt(cargo.slice(3));
    const monto = importeDos(total).padStart(17, '0');
    if (monto.length !== 17)
        throw new RangeError('El total excede el ancho admitido por BCP.');
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

export function detalleBcp(
    fila: FilaExportacionDto,
    configuracion: ConfiguracionExportacionDto
) {
    const abono = cuentaAbono(fila, configuracion);
    if (abono.cuenta === configuracion.cuenta_cargo)
        throw new RangeError('La cuenta de cargo y abono no pueden coincidir.');
    const documento = fila.cabecera.nro_documento;
    if (!/^[a-zA-Z0-9]{1,12}$/.test(documento))
        throw new RangeError(
            'El documento BCP debe ser alfanumérico y tener hasta 12 posiciones.'
        );
    const monto = importeDos(fila.resultado.neto_a_pagar).padStart(17, '0');
    if (monto.length !== 17 || new Decimal(monto).isZero())
        throw new RangeError(
            'El abono debe ser positivo y caber en 17 posiciones.'
        );
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
