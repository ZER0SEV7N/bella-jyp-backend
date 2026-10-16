import Decimal from 'decimal.js';
import type { EntradaPlanilla, SalidaPlanilla } from './planilla.types';

export const VERSION_MOTOR_PLANILLA = '2026-10-15.1';
//La configuración se limita a este constructor; no altera el Decimal global de otras librerías.
const Dinero = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const decimal = (valor: string) => {
    const resultado = new Dinero(valor);
    if (!resultado.isFinite() || resultado.isNegative()) throw new RangeError('Los importes y tasas deben ser decimales finitos no negativos.');
    return resultado;
};
const r4 = (valor: Decimal) => {
    const redondeado = valor.toDecimalPlaces(4);
    if (redondeado.abs().gte('100000000')) throw new RangeError('El resultado excede NUMERIC(12,4).');
    return redondeado.toFixed(4);
};

/** El tramo representa un límite acumulado expresado en UIT. */
export function impuestoAnualQuinta(rentaNeta: Decimal, uit: Decimal): Decimal {
    let anterior = new Dinero(0), impuesto = new Dinero(0);
    for (const [limiteUit, tasa] of [[5, '0.08'], [20, '0.14'], [35, '0.17'], [45, '0.20'], [null, '0.30']] as const) {
        if (rentaNeta.lte(anterior)) break;
        const limite = limiteUit === null ? rentaNeta : uit.mul(limiteUit);
        impuesto = impuesto.add(Dinero.min(rentaNeta, limite).sub(anterior).mul(tasa));
        anterior = limite;
    }
    return impuesto;
}

/** El corte de retenciones es fijo dentro de cada tramo del artículo 40, no siempre el mes anterior. */
export function corteRetencionesQuinta(mes: number): { hastaMes: number; divisor: number } {
    if (mes <= 3) return { hastaMes: 0, divisor: 12 };
    if (mes === 4) return { hastaMes: 3, divisor: 9 };
    if (mes <= 7) return { hastaMes: 4, divisor: 8 };
    if (mes === 8) return { hastaMes: 7, divisor: 5 };
    if (mes <= 11) return { hastaMes: 8, divisor: 4 };
    return { hastaMes: 11, divisor: 1 };
}

type ParametrosPlanilla = Record<keyof EntradaPlanilla['parametros'], Decimal>;

function validarEntrada(entrada: EntradaPlanilla): { mes: number; sueldo: Decimal; horas: Decimal; parametros: ParametrosPlanilla } {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(entrada.periodo)) throw new RangeError('Período de cálculo inválido.');
    const mes = Number(entrada.periodo.slice(5));
    const cantidades = [entrada.dias_vinculo, entrada.dias_remunerables, entrada.faltas, entrada.dias_sin_goce,
        entrada.minutos_tardanza, entrada.minutos_salida_anticipada, entrada.minutos_sin_goce,
        entrada.minutos_extras_25, entrada.minutos_extras_35];
    if (cantidades.some(valor => !Number.isSafeInteger(valor) || valor < 0))
        throw new RangeError('Los días y minutos deben ser enteros no negativos.');
    if (entrada.dias_vinculo > 30 || entrada.dias_remunerables !== entrada.dias_vinculo - entrada.faltas - entrada.dias_sin_goce)
        throw new RangeError('Los días de asistencia no son consistentes.');
    const sueldo = decimal(entrada.sueldo_basico), horas = decimal(entrada.horas_diarias);
    if (sueldo.lte(0) || horas.lte(0)) throw new RangeError('El sueldo y las horas diarias deben ser mayores que cero.');
    const parametros = Object.fromEntries(Object.entries(entrada.parametros).map(([clave, valor]) => [clave, decimal(valor)])) as ParametrosPlanilla;
    if (sueldo.lt(parametros.RMV)) throw new RangeError('El sueldo de una jornada completa no puede ser inferior a la RMV vigente.');
    if ([parametros.ESSALUD_PCT, parametros.ONP_PCT, parametros.VIDA_LEY_PCT].some(tasa => tasa.gt(1)))
        throw new RangeError('Las tasas legales deben configurarse como fracciones entre cero y uno.');
    if (!['ESSALUD_REGULAR', 'EPS', 'ESSALUD_Y_EPS'].includes(entrada.regimen_salud))
        throw new RangeError('El régimen de salud requiere un cálculo específico no habilitado.');
    return { mes, sueldo, horas, parametros };
}

function calcularBases(entrada: EntradaPlanilla, sueldo: Decimal, horas: Decimal, parametros: ParametrosPlanilla) {
    const familiar = entrada.asignacion_familiar && entrada.dias_vinculo > 0 ? parametros.RMV.mul('0.10') : new Dinero(0);
    const baseDia = sueldo.add(familiar).div(30), baseMinuto = baseDia.div(horas).div(60);
    const sueldoPeriodo = sueldo.mul(entrada.dias_vinculo).div(30);
    const extras25 = baseMinuto.mul(entrada.minutos_extras_25).mul('1.25');
    const extras35 = baseMinuto.mul(entrada.minutos_extras_35).mul('1.35');
    const faltas = baseDia.mul(entrada.faltas);
    const tardanzas = baseMinuto.mul(entrada.minutos_tardanza + entrada.minutos_salida_anticipada);
    const sinGoce = baseDia.mul(entrada.dias_sin_goce).add(baseMinuto.mul(entrada.minutos_sin_goce));
    if ((entrada.faltas > 0 || entrada.dias_sin_goce > 0) && entrada.descuento_dso === null)
        throw new RangeError('El ausentismo requiere que el contador determine y apruebe el efecto en el descanso semanal remunerado.');
    const dso = decimal(entrada.descuento_dso ?? '0'), bono = decimal(entrada.bono_extraordinario);
    const basePrevisional = sueldoPeriodo.add(familiar).add(extras25).add(extras35).add(bono).sub(faltas).sub(tardanzas).sub(sinGoce).sub(dso);
    if (basePrevisional.lt(0)) throw new RangeError('Las incidencias superan la remuneración del período.');
    return { familiar, sueldoPeriodo, extras25, extras35, faltas, tardanzas, sinGoce, dso, bono, basePrevisional };
}

function calcularAportes(entrada: EntradaPlanilla, basePrevisional: Decimal) {
    let onp = new Dinero(0), fondo = new Dinero(0), seguro = new Dinero(0), comision = new Dinero(0), tasa: Decimal | null = null;
    if (entrada.regimen === 'ONP') return { onp: basePrevisional.mul(decimal(entrada.parametros.ONP_PCT)), fondo, seguro, comision, tasa };
    if (!entrada.afp?.tope_seguro) throw new RangeError('La AFP necesita una remuneración máxima asegurable vigente.');
    const aporte = decimal(entrada.afp.aporte), prima = decimal(entrada.afp.prima);
    let flujo: Decimal | null = null;
    if (entrada.tipo_comision === 'FLUJO') flujo = decimal(entrada.afp.flujo);
    else if (entrada.tipo_comision === 'MIXTA' && entrada.afp.flujo_mixta !== null) flujo = decimal(entrada.afp.flujo_mixta);
    if (flujo === null) throw new RangeError(entrada.tipo_comision === 'MIXTA'
        ? 'Debe configurar el componente sobre remuneración de la comisión mixta; la comisión anual sobre saldo no se descuenta del sueldo.'
        : 'El tipo de comisión AFP no está soportado por este cálculo.');
    fondo = basePrevisional.mul(aporte).div(100);
    seguro = Dinero.min(basePrevisional, decimal(entrada.afp.tope_seguro)).mul(prima).div(100);
    comision = basePrevisional.mul(flujo).div(100);
    tasa = aporte.add(prima).add(flujo);
    return { onp, fondo, seguro, comision, tasa };
}

function calcularQuinta(entrada: EntradaPlanilla, mes: number, sueldo: Decimal, familiar: Decimal, bono: Decimal,
    basePrevisional: Decimal, parametros: ParametrosPlanilla, eps: boolean) {
    const gratificacion = mes === 7 || mes === 12 ? sueldo.add(familiar).mul(entrada.meses_gratificacion).div(6) : new Dinero(0);
    if (entrada.meses_gratificacion < 0 || entrada.meses_gratificacion > 6)
        throw new RangeError('El semestre de gratificación debe tener de cero a seis meses computables.');
    const bonificacion = gratificacion.mul(eps ? '0.0675' : '0.09');
    const ingresosActualesAfectos = basePrevisional.sub(bono).add(gratificacion).add(bonificacion);
    let gratificacionesFuturas = 0;
    if (mes < 7) gratificacionesFuturas = 2;
    else if (mes < 12) gratificacionesFuturas = 1;
    const proyectado = decimal(entrada.ingresos_previos).add(ingresosActualesAfectos).add(sueldo.add(familiar).mul(12 - mes))
        .add(sueldo.add(familiar).mul(gratificacionesFuturas).mul(eps ? '1.0675' : '1.09'));
    const rentaNeta = Dinero.max(0, proyectado.sub(parametros.UIT.mul(7)));
    const quintaOrdinaria = Dinero.max(0, impuestoAnualQuinta(rentaNeta, parametros.UIT).sub(decimal(entrada.retenciones_hasta_corte))).div(corteRetencionesQuinta(mes).divisor);
    const quintaAdicional = impuestoAnualQuinta(Dinero.max(0, proyectado.add(bono).sub(parametros.UIT.mul(7))), parametros.UIT).sub(impuestoAnualQuinta(rentaNeta, parametros.UIT));
    return { gratificacion, bonificacion, quinta: quintaOrdinaria.add(quintaAdicional) };
}

/** Cálculo mensual para el alcance de oficina: no consulta el reloj, la red ni la base de datos. */
export function calcularPlanilla(entrada: EntradaPlanilla): SalidaPlanilla {
    const { mes, sueldo, horas, parametros } = validarEntrada(entrada);
    const bases = calcularBases(entrada, sueldo, horas, parametros);
    const { familiar, sueldoPeriodo, extras25, extras35, faltas, tardanzas, sinGoce, dso, bono, basePrevisional } = bases;
    const { onp, fondo, seguro, comision, tasa } = calcularAportes(entrada, basePrevisional);
    const eps = ['EPS', 'ESSALUD_Y_EPS'].includes(entrada.regimen_salud);
    const { gratificacion, bonificacion, quinta } = calcularQuinta(
        entrada, mes, sueldo, familiar, bono, basePrevisional, parametros, eps,
    );
    //En EPS el crédito tiene límites propios; se bloquea hasta disponer de su configuración completa.
    if (eps) throw new RangeError('La liquidación con EPS requiere configurar su crédito y límites antes de habilitar este motor.');
    const ingresos = { sueldo_base: r4(sueldoPeriodo), asignacion_familia: r4(familiar), horas_extras_25: r4(extras25), horas_extras_35: r4(extras35), recargo_nocturno: '0.0000', gratificacion: r4(gratificacion), bonif_extraordinaria: r4(bonificacion), bono_extraordinario: r4(bono) };
    const descuentos = { descuento_faltas: r4(faltas), descuento_tardanzas: r4(tardanzas), descuento_sin_goce: r4(sinGoce), descuento_dso: r4(dso), descuento_autorizado: r4(decimal(entrada.descuento_autorizado)), descuento_onp: r4(onp), descuento_afp_fondo: r4(fondo), descuento_afp_seguro: r4(seguro), descuento_afp_comision: r4(comision), descuento_quinta: r4(quinta), descuento_adelanto: r4(decimal(entrada.adelantos_desembolsados)), descuento_eps: '0.0000' };
    //Los totales se suman desde los importes almacenados; así concilian con sus conceptos a cuatro decimales.
    const sumar = (valores: Record<string, string>) => Object.values(valores).reduce((total, v) => total.add(v), new Dinero(0));
    const totalIngresos = sumar(ingresos), totalDescuentos = sumar(descuentos), neto = totalIngresos.sub(totalDescuentos);
    if (neto.lt(0)) throw new RangeError('El neto resulta negativo y requiere una revisión contable.');
    return { dias_laborados: entrada.dias_remunerables, ...ingresos, ...descuentos, tasa_afp_aplicada: tasa ? r4(tasa) : null,
        base_essalud: entrada.dias_sin_goce === entrada.dias_vinculo && basePrevisional.isZero() ? '0.0000' : r4(Dinero.max(basePrevisional, parametros.RMV)), base_previsional: r4(basePrevisional),
        aporte_essalud: entrada.dias_sin_goce === entrada.dias_vinculo && basePrevisional.isZero() ? '0.0000' : r4(Dinero.max(basePrevisional, parametros.RMV).mul(parametros.ESSALUD_PCT)), aporte_vida_ley: r4(basePrevisional.mul(parametros.VIDA_LEY_PCT)),
        total_ingresos: r4(totalIngresos), total_descuentos: r4(totalDescuentos), neto_a_pagar: r4(neto), version_motor: VERSION_MOTOR_PLANILLA };
}
