import { ServerTime } from "@/common/utils/server-time";
import { Decimal } from "@prisma/client/runtime/client";

const r4 = (valor: Decimal) => valor.toDecimalPlaces(4);

const valor_dia = (sueldoComputable: Decimal) => sueldoComputable.div(30);

const valor_hora = (horasDiarias: Decimal, sueldoComputable: Decimal) =>
    valor_dia(sueldoComputable).div(horasDiarias);

const valor_minuto = (horasDiarias: Decimal, sueldoComputable: Decimal) =>
    valor_hora(horasDiarias, sueldoComputable).div(60);

const calcular_asignacion = (tieneAsignacion: boolean, rmv: Decimal) =>
    tieneAsignacion ? rmv.mul('0.10') : new Decimal(0);

const calcular_horaExtra = (horas: Decimal, valorHora: Decimal, recargo: Decimal.Value) =>
    horas.mul(valorHora).mul(recargo);

const es_mes_gratificacion = () => {
    const mes = ServerTime.obtenerMesActual; // 1 a 12
    return mes === 7 || mes === 12;
};

const calcular_gratificacion = (sueldoComputable: Decimal, mesesCompletos: number) =>
    es_mes_gratificacion() && mesesCompletos >= 1
        ? sueldoComputable.div(6).mul(mesesCompletos)
        : new Decimal(0);

const calcular_bonificacion = (gratificacion: Decimal, tieneEPS: boolean) =>
    gratificacion.mul(tieneEPS ? '0.0675' : '0.09');

const calcular_base_previsional = (
    sueldo: Decimal, asignacion: Decimal, he25: Decimal, he35: Decimal,
    recargoNocturno: Decimal, descFaltas: Decimal, descTardanzas: Decimal,
) => sueldo.add(asignacion).add(he25).add(he35).add(recargoNocturno)
    .sub(descFaltas).sub(descTardanzas);

const calcular_pension = (
    esONP: boolean, base: Decimal, onpPct: Decimal,
    comision: any, tipoComision: string | null,
) => {
    if (esONP) {
        return {
            descuento_onp: base.mul(onpPct), // ONP_PCT ya es fracción (0.13)
            descuento_afp_fondo: new Decimal(0),
            descuento_afp_seguro: new Decimal(0),
            descuento_afp_comision: new Decimal(0),
            tasa_afp_aplicada: null as Decimal | null,
        };
    }
    if (!comision) throw new Error('Empleado en AFP sin comisión vigente');

    const { aporte_obligatorio, comision_sobre_ra, prima_seguro, comision_mixta } = comision;
    const comisionAFP: Decimal =
        tipoComision?.toUpperCase() === 'MIXTA' ? comision_mixta : comision_sobre_ra;

    // comisiones_afp guarda porcentajes (10.0000): aquí sí se divide entre 100
    return {
        descuento_onp: new Decimal(0),
        descuento_afp_fondo: base.mul(aporte_obligatorio).div(100),
        descuento_afp_seguro: base.mul(prima_seguro).div(100),
        descuento_afp_comision: base.mul(comisionAFP).div(100),
        tasa_afp_aplicada: aporte_obligatorio.add(prima_seguro).add(comisionAFP) as Decimal | null,
    };
};

// =========================================================================
// SALUD Y APORTES DE LA EMPRESA
// =========================================================================
const tiene_eps = (regimenSalud: string) =>
    regimenSalud === 'EPS' || regimenSalud === 'ESSALUD_Y_EPS';

const calcular_essalud = (base: Decimal, rmv: Decimal, essaludPct: Decimal) =>
    Decimal.max(base, rmv).mul(essaludPct); // ESSALUD_PCT ya es fracción (0.09)

const calcular_vida_ley = (base: Decimal, vidaLeyPct: Decimal) => base.mul(vidaLeyPct);

// =========================================================================
// QUINTA CATEGORÍA (retención del mes)
// Si la renta neta proyectada no supera 7 UIT, el empleado no figura y retorna 0
// =========================================================================
const TRAMOS_QUINTA: { hasta: number | null; tasa: string }[] = [
    { hasta: 5, tasa: '0.08' },
    { hasta: 20, tasa: '0.14' },
    { hasta: 35, tasa: '0.17' },
    { hasta: 45, tasa: '0.20' },
    { hasta: null, tasa: '0.30' },
];

// Divisor según el mes (verificar contra la tabla vigente de SUNAT)
const divisor_quinta = (mes: number) =>
    mes <= 3 ? 12 : mes === 4 ? 9 : mes <= 7 ? 8 : mes === 8 ? 5 : mes <= 11 ? 4 : 1;

const impuesto_anual = (rentaNeta: Decimal, uit: Decimal) => {
    let impuesto = new Decimal(0);
    let limiteAnterior = new Decimal(0);

    for (const tramo of TRAMOS_QUINTA) {
        if (rentaNeta.lte(limiteAnterior)) break;
        const limite = tramo.hasta === null ? rentaNeta : uit.mul(tramo.hasta);
        const montoEnTramo = Decimal.min(rentaNeta, limite).sub(limiteAnterior);
        impuesto = impuesto.add(montoEnTramo.mul(tramo.tasa));
        limiteAnterior = limite;
    }
    return impuesto;
};

const calcular_quinta = (
    uit: Decimal,
    sueldoComputable: Decimal,
    ingresosMesActual: Decimal,   // total_ingresos del mes (con gratificación si toca)
    ingresosPrevios: Decimal,     // suma total_ingresos de enero al mes anterior
    retencionesPrevias: Decimal,  // suma descuento_quinta de enero al mes anterior
    tieneEPS: boolean,
) => {
    const mes = ServerTime.obtenerMesActual;
    const mesesFuturos = 12 - mes;
    // En julio la gratificación del mes ya está en ingresosMesActual; queda la de diciembre
    const gratificacionesFuturas = mes < 7 ? 2 : mes < 12 ? 1 : 0;
    const factorBonificacion = tieneEPS ? '1.0675' : '1.09';

    const rentaAnual = ingresosPrevios
        .add(ingresosMesActual)
        .add(sueldoComputable.mul(mesesFuturos))
        .add(sueldoComputable.mul(gratificacionesFuturas).mul(factorBonificacion));

    // Solo se retiene si la renta anual supera las 7 UIT
    const limiteExonerado = uit.mul(7);
    if (rentaAnual.lte(limiteExonerado)) return new Decimal(0);

    const rentaNeta = rentaAnual.sub(limiteExonerado);

    const pendiente = impuesto_anual(rentaNeta, uit).sub(retencionesPrevias);
    if (pendiente.lte(0)) return new Decimal(0);

    return pendiente.div(divisor_quinta(mes));
};


export function calculoPlanilla(
    horas_jornada: Decimal,                 
    mesesTrabajados: number,                
    diasLaborales: number,                  
    asignacionFamiliar: boolean,
    datosFinanciero: any,
    incidencia: any,
    adelantados: any,
    parametrosLegales: any,                 // Record<Parametro, Decimal>
    tipo_comision: string | null,
    acumulados: { ingresosPrevios: Decimal; retencionesPrevias: Decimal },
) {
    if (!incidencia) throw new Error('No hay incidencia aprobada para el periodo');

    // ---------- base de cálculo
    const SUELDO_BASICO: Decimal = datosFinanciero.sueldo_basico;
    const asignacion_familia = calcular_asignacion(asignacionFamiliar, parametrosLegales.RMV);
    const SUELDO_COMPUTABLE = SUELDO_BASICO.add(asignacion_familia);

    const HORAS_DIARIAS = horas_jornada.div(diasLaborales);
    const VALOR_DIA = valor_dia(SUELDO_COMPUTABLE);
    const VALOR_HORA = valor_hora(HORAS_DIARIAS, SUELDO_COMPUTABLE);
    const VALOR_MINUTO = valor_minuto(HORAS_DIARIAS, SUELDO_COMPUTABLE);

    // ---------- ingresos
    const horas_extras_25 = calcular_horaExtra(incidencia.horas_extras_25, VALOR_HORA, '1.25');
    const horas_extras_35 = calcular_horaExtra(incidencia.horas_extras_35, VALOR_HORA, '1.35');
    const recargo_nocturno = new Decimal(0);

    const epsValida = tiene_eps(datosFinanciero.regimen_salud);
    const gratificacion = calcular_gratificacion(SUELDO_COMPUTABLE, mesesTrabajados);
    const bonif_extraordinaria = calcular_bonificacion(gratificacion, epsValida);

    // ---------- ausentismo
    const descuento_faltas = VALOR_DIA.mul(incidencia.faltas);
    const descuento_tardanzas = VALOR_MINUTO.mul(incidencia.minutos_tardanza);

    // ---------- pensiones
    const BASE_PREVISIONAL = calcular_base_previsional(
        SUELDO_BASICO, asignacion_familia, horas_extras_25, horas_extras_35,
        recargo_nocturno, descuento_faltas, descuento_tardanzas,
    );
    const esONP = datosFinanciero.regimen_pension.nombre.trim().toUpperCase() === 'ONP';
    const pension = calcular_pension(
        esONP, BASE_PREVISIONAL, parametrosLegales.ONP_PCT,
        datosFinanciero.tipo_afp?.comisiones_afp[0], tipo_comision,
    );

    // ---------- total de ingresos (parte del sueldo completo; faltas y tardanzas se restan una sola vez en descuentos)
    const total_ingresos = SUELDO_BASICO
        .add(asignacion_familia).add(horas_extras_25).add(horas_extras_35)
        .add(recargo_nocturno).add(gratificacion).add(bonif_extraordinaria);

    // ---------- descuentos adicionales
    const descuento_quinta = calcular_quinta(
        parametrosLegales.UIT, SUELDO_COMPUTABLE, total_ingresos,
        acumulados.ingresosPrevios, acumulados.retencionesPrevias, epsValida,
    );
    const descuento_adelanto = new Decimal(adelantados.totalMonto);
    const descuento_eps = epsValida ? datosFinanciero.eps_costo_adicional : new Decimal(0);

    // ---------- aportes de la empresa (no descuentan del trabajador)
    const aporte_essalud = calcular_essalud(
        BASE_PREVISIONAL, parametrosLegales.RMV, parametrosLegales.ESSALUD_PCT,
    );
    const aporte_vida_ley = calcular_vida_ley(BASE_PREVISIONAL, parametrosLegales.VIDA_LEY_PCT);

    // ---------- totales
    const total_descuentos = descuento_faltas.add(descuento_tardanzas)
        .add(pension.descuento_onp).add(pension.descuento_afp_fondo)
        .add(pension.descuento_afp_seguro).add(pension.descuento_afp_comision)
        .add(descuento_quinta).add(descuento_adelanto).add(descuento_eps);

    const neto_a_pagar = total_ingresos.sub(total_descuentos);

    return {
        dias_laborados: 30 - incidencia.faltas,
        sueldo_base: r4(SUELDO_BASICO),
        asignacion_familia: r4(asignacion_familia),
        horas_extras_25: r4(horas_extras_25),
        horas_extras_35: r4(horas_extras_35),
        recargo_nocturno: r4(recargo_nocturno),
        gratificacion: r4(gratificacion),
        bonif_extraordinaria: r4(bonif_extraordinaria),
        descuento_faltas: r4(descuento_faltas),
        descuento_tardanzas: r4(descuento_tardanzas),
        descuento_onp: r4(pension.descuento_onp),
        descuento_afp_fondo: r4(pension.descuento_afp_fondo),
        descuento_afp_seguro: r4(pension.descuento_afp_seguro),
        descuento_afp_comision: r4(pension.descuento_afp_comision),
        tasa_afp_aplicada: pension.tasa_afp_aplicada ? r4(pension.tasa_afp_aplicada) : null,
        descuento_quinta: r4(descuento_quinta),
        descuento_adelanto: r4(descuento_adelanto),
        descuento_eps: r4(descuento_eps),
        aporte_essalud: r4(aporte_essalud),
        aporte_vida_ley: r4(aporte_vida_ley),
        total_ingresos: r4(total_ingresos),
        total_descuentos: r4(total_descuentos),
        neto_a_pagar: r4(neto_a_pagar),
    };
}