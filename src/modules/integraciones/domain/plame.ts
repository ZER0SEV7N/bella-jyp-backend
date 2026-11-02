//src/modules/integraciones/domain/plame.ts
import type { ConfiguracionExportacionDto, FilaExportacionDto } from '@jyp/shared-contracts';
import Decimal from 'decimal.js';
import { CamposClasificacionPlameSchema } from '@jyp/shared-contracts';
import { importeDos, tipoDocumento } from './campos-formato';
import { CODIGOS_PLAME_VALIDOS } from './tabla22-plame';

/**
 * Funcion de dominio que formatea los campos de un archivo de texto plano para cumplir con los requisitos de longitud y formato.
 */

/**
 * Función que genera una línea de texto plano para el archivo de exportación a PLAME, formateando los campos según las especificaciones requeridas.
 * Anexo 3, estructura 14. Las horas se obtienen del detalle aprobado, nunca de días x 8.
 * @param fila - Un objeto que contiene los datos de la fila a exportar, incluyendo información del trabajador y sus remuneraciones.
 * @returns Una cadena que representa la línea formateada para el archivo de exportación a PLAME.
 */
export function lineaJornadaPlame(fila: FilaExportacionDto): string {
    //Validación de que el trabajador está afiliado al SPP (Sistema Privado de Pensiones)
    const horas = Math.floor(fila.minutos_ordinarios / 60);

    //Validación de que las horas ordinarias y de sobretiempo no exceden el máximo permitido por PLAME
    const extras = Math.floor(fila.minutos_sobretiempo / 60);
    if (horas > 360 || extras > 360)
        throw new RangeError('PLAME admite hasta 360 horas ordinarias y 360 de sobretiempo.');

    //Validación de que el tipo de documento tiene una equivalencia explícita para PLAME
    return [
        tipoDocumento(fila.tipo_documento, 'PLAME'),
        fila.cabecera.nro_documento,
        horas,
        fila.minutos_ordinarios % 60,
        extras,
        fila.minutos_sobretiempo % 60,
    ].join('|');
}

/**
 * Recordo de los códigos base de conceptos de remuneración y descuento, según la Tabla 22 publicada por SUNAT el 23/10/2026.
 * Se exige confirmación contable porque devengado y pagado no son equivalentes.
 * Los conceptos sin clasificación explícita requieren confirmación expresa de la empresa.
 * Equivalencias explícitas de la Tabla 22. ONP 0607 y EsSalud 0804 están excluidos del .rem por el Anexo 3.
 */
const BASE: Record<string, string> = {
    sueldo_base: '0121',
    asignacion_familia: '0201',
    horas_extras_25: '0105',
    horas_extras_35: '0106',
    descuento_afp_comision: '0601',
    descuento_afp_seguro: '0606',
    descuento_afp_fondo: '0608',
    descuento_quinta: '0605',
    descuento_adelanto: '0701',
    descuento_tardanzas: '0704',
    descuento_faltas: '0705',
    aporte_vida_ley: '0803',
};
const SIN_CLASIFICACION = CamposClasificacionPlameSchema.options; //Campos que requieren confirmación expresa de la empresa para su clasificación contable en la Tabla 22

/**
 * Función que genera las líneas de texto plano para el archivo de exportación a PLAME, formateando los campos según las especificaciones requeridas.
 * @param fila - Un objeto que contiene los datos de la fila a exportar, incluyendo información del trabajador y sus remuneraciones.
 * @param configuracion - Un objeto que contiene la configuración de exportación, incluyendo los códigos de conceptos de remuneración y descuento según la Tabla 22.
 * @returns Un arreglo de cadenas que representan las líneas formateadas para el archivo de exportación a PLAME.
 * @throws RangeError si algún concepto no tiene clasificación contable expresa o si algún código no es válido según la Tabla 22.
 */
export function lineasRemuneracionPlame(fila: FilaExportacionDto, configuracion: ConfiguracionExportacionDto): string[] {
    //Validación de que los importes pagados/descontados han sido confirmados antes de generar el archivo .rem
    if (configuracion.confirmar_montos_pagados !== true)
        throw new RangeError('Confirme los importes pagados/descontados antes de generar .rem.');

    //Validación de que los conceptos sin clasificación explícita tienen confirmación expresa de la empresa
    const codigos = { ...BASE, ...configuracion.conceptos_plame };

    //Validación de que los conceptos sin clasificación explícita tienen confirmación expresa de la empresa
    for (const campo of SIN_CLASIFICACION) {
        if (new Decimal(String(fila.resultado[campo] ?? '0')).gt(0) && !configuracion.conceptos_plame?.[campo])
            throw new RangeError(`El concepto ${campo} requiere clasificación contable expresa según la Tabla 22.`);
    }

    //Validación de que los códigos de conceptos de remuneración 
    //y descuento según la Tabla 22 son válidos y que los importes correspondientes están presentes en el snapshot
    const conceptos = new Map<string, Decimal>();

    //Recorrido de los conceptos de remuneración y descuento según la Tabla 22, 
    //validando que los códigos son válidos y que los importes correspondientes están presentes en el snapshot
    for (const [campo, codigo] of Object.entries(codigos)) {
        //Validación de que el código correspondiente al concepto está presente en la Tabla 22 y es importable en .rem
        if (!CODIGOS_PLAME_VALIDOS.includes(codigo))
            throw new RangeError(`El código ${codigo} no es importable en .rem según el catálogo revisado.`);
        
        //Validación de que el importe correspondiente al concepto está presente en el snapshot
        if (fila.resultado[campo] === undefined)
            throw new RangeError(`El snapshot no contiene el concepto ${campo}.`);
        
        //Validación de que el importe correspondiente al concepto es un número válido
        const monto = new Decimal(importeDos(fila.resultado[campo]));
        
        //Si el importe es mayor a cero, se agrega al mapa de conceptos con su código correspondiente
        if (monto.gt(0))
            conceptos.set(codigo, (conceptos.get(codigo) ?? new Decimal(0)).plus(monto));
    }

    //Recorrido de los conceptos de remuneración y descuento según la Tabla 22,
    return [...conceptos].sort(([a], [b]) => a.localeCompare(b))
        //Mapeo de los conceptos a líneas de texto plano para el archivo de exportación a PLAME, 
        //formateando los campos según las especificaciones requeridas
        .map(([codigo, monto]) => {
            const importe = monto.toFixed(2);
            if (monto.gt('9999999.99'))
                throw new RangeError('El importe excede las siete posiciones enteras permitidas por PLAME.');
            
            //En 600/700/800 el aplicativo considera pagado/descontado. Se consigna devengado por obligatoriedad de ambas columnas.
            return [
                tipoDocumento(fila.tipo_documento, 'PLAME'),
                fila.cabecera.nro_documento,
                codigo,
                importe,
                importe,
            ].join('|');
        });
}

/**
 * Función que genera el nombre del archivo de exportación a PLAME, formateando los campos según las especificaciones requeridas.
 * @param periodo - El periodo de exportación en formato "YYYY-MM".
 * @param ruc - El RUC de la empresa en formato de 11 dígitos.
 * @param extension - La extensión del archivo, que puede ser "jor" para jornada o "rem" para remuneración.
 * @returns - Una cadena que representa el nombre del archivo de exportación a PLAME, formateado según las especificaciones requeridas.
 */
export function nombrePlame(periodo: string, ruc: string, extension: 'jor' | 'rem'): string {
    //Validación de que el periodo y el RUC son válidos según las especificaciones requeridas
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo) || !/^\d{11}$/.test(ruc))
        throw new RangeError('El nombre PLAME requiere periodo y RUC válidos.');

    //Construcción del nombre del archivo de exportación a PLAME, concatenando los campos formateados según las especificaciones requeridas
    return `0601${periodo.replace('-', '')}${ruc}.${extension}`;
}
