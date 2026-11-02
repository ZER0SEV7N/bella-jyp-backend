//src/modules/payroll/planillas/domain/calcular-planilla.ts
import { calcularGratificacion } from './beneficios-planilla';
import { Dinero, decimal, r4 } from './dinero-planilla';
import { calcularPension } from './pension-planilla';
import type { EntradaPlanilla, SalidaPlanilla } from './planilla.types';
import { calcularQuinta } from './quinta-planilla';
import { calcularRemuneracion, validarEntradaPlanilla } from './remuneracion-planilla';
export { corteRetencionesQuinta, impuestoAnualQuinta } from './quinta-planilla';

/**
 * Constante que define la versión del motor de cálculo de planillas, utilizada para identificar la lógica y reglas aplicadas en el cálculo.
 * Se actualiza cada vez que se realizan cambios significativos en la lógica de cálculo, para asegurar la trazabilidad y consistencia de los resultados.
 * La versión sigue un formato de fecha y número de revisión, por ejemplo: '2026-10-15.1'.
 * - ENTIDAD DE NEGOCIO: Esta constante representa la versión del motor de cálculo de planillas, que es una entidad de negocio en el contexto del sistema de gestión de planillas.
 * - REGLA DE NEGOCIO: La versión del motor de cálculo de planillas es una regla de negocio que permite identificar la lógica y reglas aplicadas en el cálculo de planillas, asegurando la trazabilidad y consistencia de los resultados.
 * - OBJETO DE NEGOCIO: La versión del motor de cálculo de planillas es un objeto de negocio que encapsula la información sobre la versión del motor, incluyendo la fecha y número de revisión.
 * - PROCESO DE NEGOCIO: La versión del motor de cálculo de planillas es parte del proceso de negocio de cálculo de planillas, que implica la validación, cálculo y generación de resultados para los empleados.
 * - SERVICIO DE NEGOCIO: La versión del motor de cálculo de planillas es un servicio de negocio que proporciona información sobre la versión del motor a otros componentes del sistema, permitiendo la integración y coordinación entre diferentes módulos.
 * - TRANSACCIÓN DE NEGOCIO: La versión del motor de cálculo de planillas es una transacción de negocio que se registra y se utiliza para auditar y verificar los cálculos realizados en el sistema, asegurando la integridad y confiabilidad de los resultados.
 */
export const VERSION_MOTOR_PLANILLA = '2026-10-15.1';

/**
 * Calcula la planilla de un empleado a partir de los datos de entrada proporcionados.
 * @param entrada - Objeto que contiene los datos de entrada necesarios para el cálculo de la planilla, incluyendo información del empleado, remuneración, beneficios y descuentos.
 * @returns - Objeto que contiene los resultados del cálculo de la planilla, incluyendo ingresos, descuentos, aportes y neto a pagar.
 * @throws RangeError si los cálculos resultan en montos negativos o inconsistentes con la remuneración del período.
 */
export function calcularPlanilla(entrada: EntradaPlanilla): SalidaPlanilla {
    //Valida la entrada de la planilla y obtiene los datos necesarios para el cálculo.
    const validada = validarEntradaPlanilla(entrada);
    const { mes, sueldo, parametros } = validada;
    const remuneracion = calcularRemuneracion(entrada, validada);
    const { familiar, sueldoPeriodo, extras25, extras35, faltas, tardanzas, sinGoce, dso, bono, basePrevisional } = remuneracion;
    const { onp, fondo, seguro, comision, tasa } = calcularPension(entrada, basePrevisional, parametros);
    const beneficio = calcularGratificacion(entrada, mes, sueldo, familiar);
    const { eps, gratificacion, bonificacion } = beneficio;
    const quinta = calcularQuinta(entrada, validada, remuneracion, beneficio);
    
    //En EPS el crédito tiene límites propios; se bloquea hasta disponer de su configuración completa.
    if (eps) 
        throw new RangeError('La liquidación con EPS requiere configurar su crédito y límites antes de habilitar este motor.');
    
    //Calcula la renta neta y la proyección anual de ingresos, considerando la remuneración ordinaria, gratificaciones y bonificaciones.
    const ingresos = {
        sueldo_base: r4(sueldoPeriodo),
        asignacion_familia: r4(familiar),
        horas_extras_25: r4(extras25),
        horas_extras_35: r4(extras35),
        recargo_nocturno: '0.0000',
        gratificacion: r4(gratificacion),
        bonif_extraordinaria: r4(bonificacion),
        bono_extraordinario: r4(bono)
    };

    //Calcula los descuentos y retenciones, incluyendo faltas, tardanzas, sin goce, DSO, autorizados, ONP, AFP, quinta categoría y adelantos.
    const descuentos = {
        descuento_faltas: r4(faltas),
        descuento_tardanzas: r4(tardanzas),
        descuento_sin_goce: r4(sinGoce),
        descuento_dso: r4(dso),
        descuento_autorizado: r4(decimal(entrada.descuento_autorizado)),
        descuento_onp: r4(onp),
        descuento_afp_fondo: r4(fondo),
        descuento_afp_seguro: r4(seguro),
        descuento_afp_comision: r4(comision),
        descuento_quinta: r4(quinta),
        descuento_adelanto: r4(decimal(entrada.adelantos_desembolsados)),
        descuento_eps: '0.0000'
    };

    //Los totales se suman desde los importes almacenados; así concilian con sus conceptos a cuatro decimales.
    const sumar = (valores: Record<string, string>) => Object.values(valores).reduce((total, v) => total.add(v), new Dinero(0));
    
    //Calcula los totales de ingresos, descuentos y el neto a pagar, validando que el neto no sea negativo.
    const totalIngresos = sumar(ingresos),
        totalDescuentos = sumar(descuentos),
        neto = totalIngresos.sub(totalDescuentos);
    
    //Valida que el neto a pagar no sea negativo, ya que esto indicaría un error en los cálculos o en la entrada de datos.
    if (neto.lt(0)) 
        throw new RangeError('El neto resulta negativo y requiere una revisión contable.');

    //Devuelve el objeto de salida con todos los resultados del cálculo de la planilla, incluyendo ingresos, descuentos, aportes y neto a pagar.
    return {
        dias_laborados: entrada.dias_remunerables,
        ...ingresos,
        ...descuentos,
        tasa_afp_aplicada: tasa ? r4(tasa) : null,
        base_essalud: entrada.dias_sin_goce === entrada.dias_vinculo && basePrevisional.isZero() ? '0.0000' : r4(Dinero.max(basePrevisional, parametros.RMV)),
        base_previsional: r4(basePrevisional),
        aporte_essalud: entrada.dias_sin_goce === entrada.dias_vinculo && basePrevisional.isZero() ? '0.0000' : r4(Dinero.max(basePrevisional, parametros.RMV).mul(parametros.ESSALUD_PCT)),
        aporte_vida_ley: r4(basePrevisional.mul(parametros.VIDA_LEY_PCT)),
        total_ingresos: r4(totalIngresos),
        total_descuentos: r4(totalDescuentos),
        neto_a_pagar: r4(neto),
        version_motor: VERSION_MOTOR_PLANILLA
    };
}
