import { ServerTime } from "@/common/utils/server-time";
import { Decimal } from "@prisma/client/runtime/client";

//definir objetos de datos finales de planillas
const MONTOS_EN_CERO = {

}

const r4 = (valor: number)=> Math.round(valor * 10000) / 10000;

export async function calculoPlanilla(horas_jornada: Decimal,mesesTrabajados:number,asignacionFamiliar: boolean,datosFinanciero: any,incidencia: any,adelantados: any,parametrosLegales: any) {
    //calcular el precio por hora o por minuto para obtner el descuento
    const SUELDO_BASICO = datosFinanciero.sueldo_basico
    //realizar calculo de planillas
    const asignacion_familia = asignacionFamiliar ? parametrosLegales.RMV.mul(0.10) : new Decimal(0);
    //calcular el sueldo total del empleado con la asigancion famili
    const SUELDO_COMPUTABLE =  SUELDO_BASICO + asignacion_familia;
    //VALORES POR DEFECTO APRA CAULAR DESCUNETOS o bonificaciones
    const VALOR_DIA = valor_dia(SUELDO_COMPUTABLE); 
    const VALOR_HORA = valor_hora(horas_jornada,SUELDO_COMPUTABLE);
    const VALOR_MINUTO = valor_minuto(horas_jornada,SUELDO_COMPUTABLE)
    //calcular horas extra, recargo nosturano, gratificacion, bonif?extraidarioa
    const horas_extras_25 = calcular_horaExtra(incidencia.horas_extras_25, VALOR_HORA, 1.25);
    const horas_extras_35 = calcular_horaExtra(incidencia.horas_extras_35, VALOR_HORA, 1.35);
    //No hay recago nosctutno
    const recargo_nocturno = new Decimal(0); 
    //identifica que toca gratifcaicon
    const gratificacion = calcular_gratificacion(SUELDO_COMPUTABLE, mesesTrabajados);
    //descunetos por parte del empelado  con relacion a 5 ta categoria, afp o onp
    

    // descuentos adicionales y tributarios

    
    //aporte de essalud


    //calcular totales
}




const valor_dia = (sueldoBasico: Decimal) =>{
    return sueldoBasico.div(30);
}
const valor_hora = (horasTotales: Decimal, sueldoBasico: Decimal) =>{
    return valor_dia(sueldoBasico).div(horasTotales); 
}
const valor_minuto = (horasTotales: Decimal, sueldoBasico:Decimal ) =>{
    return valor_hora(horasTotales,sueldoBasico).div(60)
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