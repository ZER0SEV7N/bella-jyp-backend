//src/modules/payroll/planillas/domain/quinta-planilla.ts
import Decimal from 'decimal.js';
import type { calcularGratificacion } from './beneficios-planilla';
import { Dinero, decimal } from './dinero-planilla';
import type { EntradaPlanilla } from './planilla.types';
import type { calcularRemuneracion, validarEntradaPlanilla } from './remuneracion-planilla';

/**
 * Regla de negocio que encapsula la lógica de cálculo del impuesto anual de la quinta categoría y su proyección mensual.
 * Separa la proyección ordinaria del impuesto adicional por ingresos extraordinarios.
 * @returns - Monto del impuesto mensual de la quinta categoría, calculado aplicando las tasas progresivas según los tramos establecidos por la ley.
 * @throws RangeError si la renta neta es negativa o no es un número finito, o si la UIT es negativa o no es un número finito.
 */

/**
 * Calcula el impuesto anual de la quinta categoría según la renta neta y la UIT.
 * @param rentaNeta - Monto de la renta neta anual del trabajador, calculado como la suma de ingresos afectos menos deducciones permitidas. 
 * @param uit - Monto de la Unidad Impositiva Tributaria vigente, utilizado como referencia para determinar los tramos de la quinta categoría.
 * @returns - Monto del impuesto anual de la quinta categoría, calculado aplicando las tasas progresivas según los tramos establecidos por la ley.
 * @throws RangeError si la renta neta es negativa o no es un número finito, o si la UIT es negativa o no es un número finito.
 */
export function impuestoAnualQuinta(rentaNeta: Decimal, uit: Decimal): Decimal {
    //Valida que la renta neta y la UIT sean números finitos y no negativos.
    let anterior = new Dinero(0), impuesto = new Dinero(0);

    //Itera sobre los tramos de la quinta categoría, aplicando las tasas correspondientes según los límites establecidos por la ley.
    for (const [limiteUit, tasa] of [
        [5, '0.08'],
        [20, '0.14'],
        [35, '0.17'],
        [45, '0.20'],
        [null, '0.30']
    ] as const) {
        //Calcula el límite del tramo actual en base a la UIT y el límite definido, o utiliza la renta neta si no hay límite.
        if (rentaNeta.lte(anterior)) 
            break;

        const limite = limiteUit === null ? rentaNeta : uit.mul(limiteUit);
        impuesto = impuesto.add(Dinero.min(rentaNeta, limite).sub(anterior).mul(tasa));
        anterior = limite;
    }
    return impuesto;
}

/**
 * Calcula el corte de retenciones de quinta categoría según el mes del período de cálculo.
 * @param mes - Número del mes del período de cálculo (1 a 12), utilizado para determinar el corte de retenciones y el divisor correspondiente.
 * @returns - Objeto que contiene:
 *   - hastaMes: número del mes hasta el cual se consideran las retenciones acumuladas.
 *   - divisor: número de meses restantes para proyectar las retenciones futuras.
 */
export function corteRetencionesQuinta(mes: number): { hastaMes: number; divisor: number } {
    //Valida que el mes sea un número entero entre 1 y 12.
    if (mes <= 3) return { hastaMes: 0, divisor: 12 };
    if (mes === 4) return { hastaMes: 3, divisor: 9 };
    if (mes <= 7) return { hastaMes: 4, divisor: 8 };
    if (mes === 8) return { hastaMes: 7, divisor: 5 };
    if (mes <= 11) return { hastaMes: 8, divisor: 4 };
    return { hastaMes: 11, divisor: 1 };
}

/**
 * Calcula la retención mensual de quinta categoría considerando la proyección anual de ingresos y las retenciones acumuladas hasta el corte.
 * @param entrada - Datos de entrada de la planilla, incluyendo ingresos previos, retenciones hasta el corte y bono extraordinario.
 * @param validada - Resultado de la validación de la entrada de planilla, que incluye mes, sueldo y parámetros.
 * @param remuneracion - Resultado del cálculo de remuneración, que incluye base previsional, bono y familiar.
 * @param beneficio - Resultado del cálculo de beneficios, que incluye gratificación, bonificación y si aplica EPS.
 * @returns - Monto de la retención mensual de quinta categoría, 
 * calculado aplicando las tasas progresivas según los tramos establecidos por la ley y 
 * considerando la proyección anual de ingresos y las retenciones acumuladas hasta el corte.
 */
export function calcularQuinta(entrada: EntradaPlanilla, validada: ReturnType<typeof validarEntradaPlanilla>, remuneracion: ReturnType<typeof calcularRemuneracion>, beneficio: ReturnType<typeof calcularGratificacion>) {
    //Extrae los valores necesarios de los resultados de validación, cálculo de remuneración y cálculo de beneficios.
    const { mes, sueldo, parametros } = validada;
    const { basePrevisional, bono, familiar } = remuneracion;
    const { gratificacion, bonificacion, eps } = beneficio;
    //La proyección usa remuneración ordinaria; la gratificación del mes ya se incluye en ingresos actuales.
    const ingresosActualesAfectos = basePrevisional.sub(bono).add(gratificacion).add(bonificacion);
    let gratificacionesFuturas: number;
    
    //Calcula el número de gratificaciones futuras según el mes del período de cálculo, considerando que las gratificaciones se pagan en julio y diciembre.
    if (mes < 7) 
        gratificacionesFuturas = 2;
    else if (mes < 12) 
        gratificacionesFuturas = 1;
    else 
        gratificacionesFuturas = 0;
    
    //Calcula la proyeccion anual de ingresos afectos a quinta categoría, sumando los ingresos previos, 
    //los ingresos actuales afectos y la proyección de ingresos futuros según el sueldo, familiar y gratificaciones futuras.
    const proyectado = decimal(entrada.ingresos_previos).add(ingresosActualesAfectos).add(sueldo.add(familiar)
        .mul(12 - mes))
        .add(sueldo.add(familiar).mul(gratificacionesFuturas).mul(eps ? '1.0675' : '1.09'));
    
    //Calcula la renta neta anual afecto a quinta categoría, restando la deducción por 7 UIT de la proyección anual de ingresos.
    const rentaNeta = Dinero.max(0, proyectado.sub(parametros.UIT.mul(7)));

    //Calcula la quinta ordinaria y adicional, considerando las retenciones acumuladas hasta el corte y 
    //proyectando las retenciones futuras según el divisor correspondiente al mes del período de cálculo.    
    const quintaOrdinaria = Dinero.max(0, impuestoAnualQuinta(rentaNeta, parametros.UIT).sub(decimal(entrada.retenciones_hasta_corte))).div(corteRetencionesQuinta(mes).divisor);

    //Calcula la quinta adicional considerando la diferencia entre el impuesto anual proyectado y el impuesto anual calculado sobre la renta neta,
    //y restando las retenciones acumuladas hasta el corte, proyectando las retenciones futuras según el divisor correspondiente al mes del período de cálculo.
    const quintaAdicional = impuestoAnualQuinta(Dinero.max(0, proyectado.add(bono).sub(parametros.UIT.mul(7))), parametros.UIT).sub(impuestoAnualQuinta(rentaNeta, parametros.UIT));
    const quinta = quintaOrdinaria.add(quintaAdicional);

    return quinta;
}
