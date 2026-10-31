//src/modules/integraciones/domain/afpnet.ts
import type { ConfiguracionExportacionDto, FilaExportacionDto } from '@jyp/shared-contracts';
import Decimal from 'decimal.js';
import { importeDos, numeroFijo, textoFijo, tipoDocumento } from './campos-formato';

/**
 * Funcion de dominio que formatea los campos de un archivo de texto plano para cumplir con los requisitos de longitud y formato.
 * 
 */

const montoAFPNET = (valor: string) => numeroFijo(importeDos(valor).replace('.', ''), 9); //Formatea el monto a 9 dígitos, eliminando el punto decimal y 
//rellenando con ceros a la izquierda si es necesario

/**
 * Función que genera una línea de texto plano para el archivo de exportación a AFPNET, formateando los campos según las especificaciones requeridas.
 * @param fila - Un objeto que contiene los datos de la fila a exportar, incluyendo información del trabajador y sus remuneraciones.
 * @param secuencia - Un número que representa la secuencia de la línea en el archivo de exportación.
 * @param config - Un objeto que contiene la configuración de exportación, incluyendo el código de la empresa y el periodo de exportación.
 * @returns Una cadena que representa la línea formateada para el archivo de exportación a AFPNET.
 */
export function lineaAFPNET(fila: FilaExportacionDto, secuencia: number, config: ConfiguracionExportacionDto): string {
    //Validación de que el trabajador está afiliado al SPP (Sistema Privado de Pensiones)
    if (fila.regimen !== 'AFP') 
        throw new RangeError( 'AFPnet solo recibe trabajadores afiliados al SPP.');

    //Validación de que el trabajador tiene un código de empresa asignado en la configuración
    const apellidos = config.apellidos_afpnet?.[fila.empleado_id];
    if (!apellidos)
        throw new RangeError('AFPnet requiere apellido paterno y materno separados y confirmados; no se divide el apellido por espacios.');
    //Validación de que el trabajador tiene aportes voluntarios confirmados en la configuración
    const voluntarios = config.aportes_voluntarios?.[fila.empleado_id];
    if (!voluntarios)
        throw new RangeError('Confirme expresamente los tres aportes voluntarios, aunque sus importes sean cero.');
    
    //Validación de que la remuneración base no es cero, ya que esto requiere declarar una excepción de aportar
    const base = importeDos(fila.resultado.base_previsional);
    if (new Decimal(base).isZero())
        throw new RangeError('La remuneración cero requiere declarar la excepción de aportar; este alcance no infiere su motivo.');
    
    //Validación de que el CUSPP (Código Único de Seguridad Social) tiene doce posiciones o está vacío
    if (fila.cuspp && !/^[a-zA-Z0-9]{12}$/.test(fila.cuspp))
        throw new RangeError('El CUSPP debe tener doce posiciones o quedar vacío.');

    //Validación de que la fecha de inicio y cese del trabajador coincide con el periodo de exportación, 
    //para determinar si se debe marcar como inicio o cese en la línea de exportación
    const inicio = fila.fecha_inicio.slice(0, 7) === fila.periodo ? 'S' : 'N';
    
    //Validación de que la fecha de cese del trabajador coincide con el periodo de exportación,
    const cese = fila.fecha_cese?.slice(0, 7) === fila.periodo ? 'S' : 'N';

    //Construcción de la línea de texto plano para el archivo de exportación a AFPNET, concatenando los campos formateados según las especificaciones requeridas
    const linea =
        numeroFijo(String(secuencia), 5) +
        textoFijo(fila.cuspp ?? '', 12) +
        tipoDocumento(fila.tipo_documento, 'AFPNET') +
        textoFijo(fila.cabecera.nro_documento, 20) +
        textoFijo(apellidos.paterno.toUpperCase(), 20) +
        textoFijo(apellidos.materno.toUpperCase(), 20) +
        textoFijo(fila.nombres.toUpperCase(), 20) +
        'S' +
        inicio +
        cese +
        ' ' +
        montoAFPNET(base) +
        montoAFPNET(voluntarios.con_fin) +
        montoAFPNET(voluntarios.sin_fin) +
        montoAFPNET(voluntarios.empleador) +
        'N' +
        '  ';

    //Validación de que la línea generada tiene exactamente 141 posiciones, ya que este es un requisito del formato de archivo de AFPNET
    if (linea.length !== 141)
        throw new RangeError('La línea AFPnet no tiene 141 posiciones.');
    return linea;
}
