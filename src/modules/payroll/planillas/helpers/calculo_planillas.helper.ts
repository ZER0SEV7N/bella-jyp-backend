import { ServerTime } from "@/common/utils/server-time";
import { Decimal } from "@prisma/client/runtime/client";

//definir objetos de datos finales de planillas
const MONTOS_EN_CERO = {

}

const r4 = (valor: number)=> Math.round(valor * 10000) / 10000;

export async function calculoPlanilla(horas_jornada: Decimal, mesesTrabajados:number,diasLaborales: number,asignacionFamiliar: boolean,datosFinanciero: any,incidencia: any,adelantados: any,parametrosLegales: any) {
    //calcular el precio por hora o por minuto para obtner el descuento
    const SUELDO_BASICO = datosFinanciero.sueldo_basico
    //realizar calculo de planillas
    const asignacion_familia = asignacionFamiliar ? parametrosLegales.RMV.mul(0.10) : new Decimal(0);
    //calcular el sueldo total del empleado con la asigancion famili
    const SUELDO_COMPUTABLE =  SUELDO_BASICO.add(asignacion_familia);
    //VALORES POR DEFECTO APRA CAULAR DESCUNETOS o bonificaciones
    const HORAS_DIARIAS =horas_jornada.div(diasLaborales);
    const VALOR_DIA = valor_dia(SUELDO_COMPUTABLE); 
    const VALOR_HORA = valor_hora(HORAS_DIARIAS,SUELDO_COMPUTABLE);
    const VALOR_MINUTO = valor_minuto(HORAS_DIARIAS,SUELDO_COMPUTABLE) 
    //calcular horas extra, recargo nosturano, gratificacion, bonif?extraidarioa
    const horas_extras_25 = calcular_horaExtra(incidencia.horas_extras_25, VALOR_HORA, 1.25);
    const horas_extras_35 = calcular_horaExtra(incidencia.horas_extras_35, VALOR_HORA, 1.35);
    //No hay recago nosctutno
    const recargo_nocturno = new Decimal(0); 
    //identifica que toca gratifcaicon
    const gratificacion = calcular_gratificacion(SUELDO_COMPUTABLE, mesesTrabajados);
    //descunetos por parte del empelado  con relacion a 5 ta categoria, afp o onp
    const bonif_extraordinaria = new Decimal(0);
    // descuentos con realcion a tardanza y faltas
    const descuento_faltas = VALOR_DIA.mul(incidencia.faltas); 
    const descuento_tardanzas = VALOR_MINUTO.mul(incidencia.minutos_tardanza);
    const BASE_PROVISIONAL = SUELDO_BASICO.add(asignacionFamiliar).add(horas_extras_25).add(horas_extras_35).add(recargo_nocturno).sub(descuento_faltas).sub(descuento_tardanzas);
    //calcular el descuento de la onp o afp segun el empleado
    const descuento_onp = datosFinanciero.regimen_pension.nombre === 'ONP'?  BASE_PROVISIONAL.mul(parametrosLegales.ONP_PCT): new Decimal(0);
    //extraer datos de las comisones actuales
    const comisionesActuales= datosFinanciero.tipo_afp?.comisiones_afp[0] || {};
    //deglozar las comsiones
    const { aporte_obligatorio, comision_sobre_ra, prima_seguro, comision_mixta} = comisionesActuales;
    const descuento_afp_fondo = datosFinanciero.regimen_pension.nombre === 'ONP'? BASE_PROVISIONAL.mul(aporte_obligatorio) : new Decimal(0);
    const descuento_afp_seguro = datosFinanciero.regimen_pension.nombre === 'ONP'? BASE_PROVISIONAL.mul(prima_seguro) : new Decimal(0) ;
    const descuento_afp_comision = datosFinanciero.regimen_pension.nombre === 'ONP'? BASE_PROVISIONAL.mul(comision_mixta) : new Decimal(0);
    const tasa_afp_aplicada = datosFinanciero.regimen_pension.nombre === 'ONP'? BASE_PROVISIONAL.mul() : null; 

    //descuentos tributarios 
    const descuento_quinta = new Decimal(0);
     
}




const valor_dia = (sueldoBasico: Decimal) =>{
    return sueldoBasico.div(30);
}
const valor_hora = (horasDiarias: Decimal, sueldoBasico: Decimal) =>{
    return valor_dia(sueldoBasico).div(horasDiarias); 
}
const valor_minuto = (horasDiarias: Decimal, sueldoBasico:Decimal ) =>{
    return valor_hora(horasDiarias,sueldoBasico).div(60)
}

const calcular_horaExtra = (horas_extra_registradas: Decimal, valorHora:Decimal, valor_hora_extra:Decimal.Value)=>{
    return horas_extra_registradas.mul(valorHora).mul(valor_hora_extra); 
}

//validar si es fecha de gratificacion o no 
const  validar_gratifcacion = (): boolean => {
    const yearActual = ServerTime.obtenerYearActual;
    const peridoActual = ServerTime.obtenerPeriodoActual;
    //fechas pemritidas para gratificacion
    const fechas_gratificacion = [
        `${yearActual}-06`, `${yearActual}-12`
    ]
    return fechas_gratificacion.includes(peridoActual);
}
const calcular_gratificacion = (sueldoComputable:Decimal,mesesTrabajdosEmpelados:number): Decimal => {
    if (validar_gratifcacion()) {
        //realizar cde gratificacion si es gratificacion, dividiendo los meses totales y multiplicarlo con los meses trabajdos
        const gratificacion_total = sueldoComputable.div(6).mul(mesesTrabajdosEmpelados);    
        return gratificacion_total;
    }   
    return new Decimal(0);
}
