//src/modules/payroll/planillas/domain/beneficios-planilla.ts
import Decimal from 'decimal.js';
import { Dinero } from './dinero-planilla';
import type { EntradaPlanilla } from './planilla.types';

/**
 * Regla de negocio que encapsula la lógica de cálculo de gratificaciones y bonificaciones.
 * Separa la proyección ordinaria del impuesto adicional por ingresos extraordinarios.
 * @param entrada - Datos de entrada de la planilla, incluyendo régimen de salud y meses computables para gratificación.
 * @param mes - Mes actual del período de cálculo, utilizado para determinar si corresponde gratificación.
 * @param sueldo - Sueldo básico del trabajador, utilizado para calcular la gratificación.
 * @param familiar - Monto de la asignación familiar, si aplica, utilizado para calcular la gratificación.
 * @returns - Un objeto que contiene:
 *   - eps: boolean que indica si el trabajador está en un régimen de salud EPS.
 *   - gratificacion: monto calculado de la gratificación correspondiente al período.
 *   - bonificacion: monto calculado de la bonificación adicional según el régimen de salud.
 * @throws RangeError si los meses computables para gratificación están fuera del rango permitido (0 a 6).
 */
export function calcularGratificacion(entrada: EntradaPlanilla, mes: number, sueldo: Decimal, familiar: Decimal) {
    //Determina si el trabajador está en un régimen de salud EPS.
    const eps = ['EPS', 'ESSALUD_Y_EPS'].includes(entrada.regimen_salud);

    //Calcula la gratificación solo si el mes es julio o diciembre, aplicando la proporción de meses computables.
    const gratificacion = mes === 7 || mes === 12 ? sueldo.add(familiar).mul(entrada.meses_gratificacion).div(6) : new Dinero(0);

    //Valida que los meses computables para gratificación estén dentro del rango permitido.
    if (entrada.meses_gratificacion < 0 || entrada.meses_gratificacion > 6)
        throw new RangeError('El semestre de gratificación debe tener de cero a seis meses computables.');
    
    //Calcula la bonificación adicional según el régimen de salud, aplicando la tasa correspondiente.
    const bonificacion = gratificacion.mul(eps ? '0.0675' : '0.09');

    return { eps, gratificacion, bonificacion };
}
