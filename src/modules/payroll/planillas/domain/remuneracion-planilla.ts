//src/modules/payroll/planillas/domain/remuneracion-planilla.ts
import Decimal from 'decimal.js';
import { Dinero, decimal } from './dinero-planilla';
import type { EntradaPlanilla } from './planilla.types';

/**
 * Entidad de negocio que encapsula la lógica de validación y cálculo de remuneración, ausencias y base previsional.
 * Separa la validación de la entrada de planilla, el cálculo de remuneración y la determinación de la base previsional.
 */

/**
 * Función que valida los datos de entrada de la planilla, asegurando que cumplan con los requisitos de formato y consistencia.
 * @param entrada - Datos de entrada de la planilla, incluyendo período, días, minutos, sueldo y parámetros.
 * @returns - Objeto que contiene el mes del período, el sueldo básico, las horas diarias y los parámetros validados.
 * @throws RangeError si los datos de entrada no cumplen con los requisitos de formato o consistencia.
 */
export function validarEntradaPlanilla(entrada: EntradaPlanilla) {
    //Valida que el período tenga el formato YYYY-MM y que el mes sea válido (01 a 12).
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(entrada.periodo)) 
        throw new RangeError('Período de cálculo inválido.');

    //Extrae el mes del período para su uso en cálculos posteriores.
    const mes = Number(entrada.periodo.slice(5));
    
    //Valida que los días y minutos sean enteros no negativos y que los días de asistencia sean consistentes con las ausencias.
    for (const valor of [
        entrada.dias_vinculo,
        entrada.dias_remunerables,
        entrada.faltas,
        entrada.dias_sin_goce,
        entrada.minutos_tardanza,
        entrada.minutos_salida_anticipada,
        entrada.minutos_sin_goce,
        entrada.minutos_extras_25,
        entrada.minutos_extras_35
    ]) {
        if (!Number.isSafeInteger(valor) || valor < 0) 
            throw new RangeError('Los días y minutos deben ser enteros no negativos.');
    }

    //Valida que los días de vinculación no excedan 30 y que los días remunerables sean consistentes con las ausencias.
    if (entrada.dias_vinculo > 30 || entrada.dias_remunerables !== entrada.dias_vinculo - entrada.faltas - entrada.dias_sin_goce)
        throw new RangeError('Los días de asistencia no son consistentes.');

    //Valida que el sueldo básico y las horas diarias sean mayores que cero y que los parámetros sean consistentes con la RMV vigente.
    const sueldo = decimal(entrada.sueldo_basico), horas = decimal(entrada.horas_diarias);
    if (sueldo.lte(0) || horas.lte(0)) 
        throw new RangeError('El sueldo y las horas diarias deben ser mayores que cero.');
    
    //Convierte los parámetros de entrada a objetos Decimal y valida que sean consistentes con la RMV vigente y las tasas legales.
    const parametros = Object.fromEntries(Object.entries(entrada.parametros).map(([clave, valor]) => [clave, decimal(valor)])) as Record<
        keyof EntradaPlanilla['parametros'],
        Decimal
    >;

    //Valida que el sueldo no sea inferior a la RMV vigente y que las tasas legales estén configuradas como fracciones entre cero y uno.
    if (sueldo.lt(parametros.RMV)) 
        throw new RangeError('El sueldo de una jornada completa no puede ser inferior a la RMV vigente.');

    //Valida que las tasas legales estén configuradas como fracciones entre cero y uno.
    for (const tasa of [parametros.ESSALUD_PCT, parametros.ONP_PCT, parametros.VIDA_LEY_PCT])
        if (tasa.gt(1)) throw new RangeError('Las tasas legales deben configurarse como fracciones entre cero y uno.');

    //Valida que el régimen de salud sea uno de los permitidos para el cálculo de remuneración y beneficios.
    if (!['ESSALUD_REGULAR', 'EPS', 'ESSALUD_Y_EPS'].includes(entrada.regimen_salud))
        throw new RangeError('El régimen de salud requiere un cálculo específico no habilitado.');

    return { mes, sueldo, horas, parametros };
}

/**
 * Calcula la remuneración del trabajador, incluyendo sueldo, horas extras, ausencias y base previsional.
 * @param entrada - Datos de entrada de la planilla, incluyendo días, minutos, sueldo y parámetros.
 * @param validada - Resultado de la validación de la entrada de planilla, que incluye mes, sueldo y parámetros.
 * @returns - Un objeto que contiene:
 *   - familiar: monto de la asignación familiar si aplica.
 *   - baseDia: monto del sueldo diario considerando la asignación familiar.
 *   - baseMinuto: monto del sueldo por minuto considerando la asignación familiar.
 *   - sueldoPeriodo: monto del sueldo proporcional a los días de vinculación.
 *   - extras25: monto de las horas extras al 25%.
 *   - extras35: monto de las horas extras al 35%.
 *   - faltas: monto de los descuentos por faltas.
 *   - tardanzas: monto de los descuentos por tardanzas y salidas anticipadas.
 *   - sinGoce: monto de los descuentos por días y minutos sin goce.
 *   - dso: monto del descuento por descanso semanal remunerado si aplica.
 *   - bono: monto del bono extraordinario si aplica.
 *   - basePrevisional: monto base sobre el cual se calculan los aportes previsionales.
 * @throws RangeError si los cálculos resultan en montos negativos o inconsistentes con la remuneración del período.
 */
export function calcularRemuneracion(entrada: EntradaPlanilla, validada: ReturnType<typeof validarEntradaPlanilla>) {
    //Extrae los valores necesarios de los resultados de validación.
    const { sueldo, horas, parametros } = validada;
    const familiar = entrada.asignacion_familiar && entrada.dias_vinculo > 0 ? parametros.RMV.mul('0.10') : new Dinero(0);
    const baseDia = sueldo.add(familiar).div(30), baseMinuto = baseDia.div(horas).div(60);
    const sueldoPeriodo = sueldo.mul(entrada.dias_vinculo).div(30);
    const extras25 = baseMinuto.mul(entrada.minutos_extras_25).mul('1.25');
    const extras35 = baseMinuto.mul(entrada.minutos_extras_35).mul('1.35');
    const faltas = baseDia.mul(entrada.faltas);
    const tardanzas = baseMinuto.mul(entrada.minutos_tardanza + entrada.minutos_salida_anticipada);
    const sinGoce = baseDia.mul(entrada.dias_sin_goce).add(baseMinuto.mul(entrada.minutos_sin_goce));

    //Valida que si hay ausentismo, el contador haya determinado y aprobado el efecto en el descanso semanal remunerado (DSO).
    if ((entrada.faltas > 0 || entrada.dias_sin_goce > 0) && entrada.descuento_dso === null)
        throw new RangeError('El ausentismo requiere que el contador determine y apruebe el efecto en el descanso semanal remunerado.');

    //Calcula el descuento por descanso semanal remunerado (DSO) si aplica, considerando que el DSO se descuenta proporcionalmente a los días de ausentismo.
    const dso = decimal(entrada.descuento_dso ?? '0'),bono = decimal(entrada.bono_extraordinario);
    const basePrevisional = sueldoPeriodo.add(familiar).add(extras25).add(extras35).add(bono).sub(faltas).sub(tardanzas).sub(sinGoce).sub(dso);

    //Valida que la base previsional no sea negativa, ya que las incidencias no pueden superar la remuneración del período.
    if (basePrevisional.lt(0)) 
        throw new RangeError('Las incidencias superan la remuneración del período.');

    return { familiar, baseDia, baseMinuto, sueldoPeriodo, extras25, extras35, faltas, tardanzas, sinGoce, dso, bono, basePrevisional };
}
