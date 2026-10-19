//src/modules/payroll/planillas/domain/dinero-planilla.ts
import Decimal from 'decimal.js';

/**
 * Entidad de negocio que encapsula la lógica de manejo de dinero y tasas en el sistema de planillas.
 * Se utiliza Decimal.js para garantizar precisión en cálculos financieros y evitar errores de redondeo.
 * Se establecen reglas de validación para asegurar que los valores sean finitos y no negativos.
 * Además, se proporciona una función de redondeo a 4 decimales con validación de límites.
 */

//Se define la clase Dinero como una extensión de Decimal con precisión y redondeo específicos para cálculos financieros.
export const Dinero = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

//Se define la función decimal que valida y convierte un valor de cadena a un objeto Dinero, asegurando que sea finito y no negativo.
export const decimal = (valor: string) => {
    const resultado = new Dinero(valor);
    if (!resultado.isFinite() || resultado.isNegative()) throw new RangeError('Los importes y tasas deben ser decimales finitos no negativos.');
    return resultado;
};

//Se define la función r4 que redondea un valor a 4 decimales y valida que no exceda el límite de NUMERIC(12,4).
export const r4 = (valor: Decimal) => {
    const redondeado = valor.toDecimalPlaces(4);
    if (redondeado.abs().gte('100000000')) throw new RangeError('El resultado excede NUMERIC(12,4).');
    return redondeado.toFixed(4);
};
