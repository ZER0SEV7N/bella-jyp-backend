//src/modules/payroll/planillas/domain/pension-planilla.ts
import Decimal from 'decimal.js';
import { Dinero, decimal } from './dinero-planilla';
import type { EntradaPlanilla } from './planilla.types';

/**
 * Entidad de negocio que encapsula la lógica de cálculo de pensiones y aportes previsionales.
 * Separa el cálculo de ONP y AFP, considerando los diferentes componentes de cada régimen.
 * @param entrada - Datos de entrada de la planilla, incluyendo régimen previsional y datos de AFP si aplica.
 * @param basePrevisional - Monto base sobre el cual se calculan los aportes previsionales.
 * @param parametros - Parámetros adicionales necesarios para el cálculo, como tasas y topes.
 * @returns - Un objeto que contiene:
 *   - onp: monto calculado del aporte a ONP si corresponde.
 *   - fondo: monto calculado del fondo de pensiones en caso de AFP.
 *   - seguro: monto calculado del seguro de invalidez y sobrevivencia en caso de AFP.
 *   - comision: monto calculado de la comisión de AFP según el tipo de comisión.
 *   - tasa: tasa total aplicada para el cálculo de aportes en caso de AFP, o null si es ONP.
 * @throws RangeError si los datos de entrada no cumplen con los requisitos para el cálculo de pensiones.
 */
export function calcularPension(entrada: EntradaPlanilla, basePrevisional: Decimal, parametros: Record<keyof EntradaPlanilla['parametros'], Decimal>) {
    //Inicializa los montos de aportes y la tasa a cero o null según corresponda.
    let onp = new Dinero(0),
        fondo = new Dinero(0),
        seguro = new Dinero(0),
        comision = new Dinero(0),
        tasa: Decimal | null = null;

    //Calcula el aporte a ONP si el régimen es ONP, aplicando la tasa correspondiente.
    if (entrada.regimen === 'ONP') onp = basePrevisional.mul(parametros.ONP_PCT);

    //Calcula los componentes de AFP si el régimen es AFP, validando la configuración de la AFP y el tipo de comisión.
    else {
        //Valida que la AFP esté configurada correctamente y que tenga un tope de seguro vigente.
        if (!entrada.afp?.tope_seguro) 
            throw new RangeError('La AFP necesita una remuneración máxima asegurable vigente.');
        
        //Obtiene los valores de aporte y prima de la AFP.
        const aporte = decimal(entrada.afp.aporte), prima = decimal(entrada.afp.prima);
        
        //Valida que el tipo de comisión sea FLUJO o MIXTA y calcula la tasa correspondiente.
        let flujo: Decimal;

        //Calcula la tasa de comisión según el tipo de comisión especificado en la entrada.
        if (entrada.tipo_comision === 'FLUJO') 
            flujo = decimal(entrada.afp.flujo);
        
        //Valida y calcula la tasa de comisión para el tipo MIXTA, asegurando que el componente de flujo mixta esté configurado.
        else if (entrada.tipo_comision === 'MIXTA') {
            if (entrada.afp.flujo_mixta === null)
                throw new RangeError('Debe configurar el componente sobre remuneración de la comisión mixta; la comisión anual sobre saldo no se descuenta del sueldo.');
            flujo = decimal(entrada.afp.flujo_mixta);
        } else 
            throw new RangeError('El tipo de comisión AFP no está soportado por este cálculo.');
        
        //Calcula los montos de fondo, seguro y comisión según las tasas y el tope de seguro, y suma las tasas para obtener la tasa total.
        fondo = basePrevisional.mul(aporte).div(100);
        seguro = Dinero.min(basePrevisional, decimal(entrada.afp.tope_seguro)).mul(prima).div(100);
        comision = basePrevisional.mul(flujo).div(100);
        tasa = aporte.add(prima).add(flujo);
    }

    return { onp, fondo, seguro, comision, tasa };
}