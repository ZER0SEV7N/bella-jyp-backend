//src/modules/payroll/planillas/domain/planilla.types.ts

/**
 * Este archivo define los tipos de datos utilizados en el cálculo masivo de planillas.
 * Se utilizan para la comunicación entre el worker de cálculo y el resto del sistema.
 * Todos los importes que cruzan el límite del worker son cadenas decimales, nunca objetos de Prisma.
 */

//Todos los importes que cruzan el límite del worker son cadenas decimales, nunca objetos de Prisma.
export interface EntradaPlanilla {
    periodo: string; empleado_id: string;
    sueldo_basico: string; asignacion_familiar: boolean; dias_vinculo: number; dias_remunerables: number;
    faltas: number; dias_sin_goce: number; minutos_tardanza: number; minutos_salida_anticipada: number; minutos_sin_goce: number;
    minutos_extras_25: number; minutos_extras_35: number; horas_diarias: string;
    regimen: 'ONP' | 'AFP'; tipo_comision: string | null; regimen_salud: string; eps_adicional: string;
    afp: null | { aporte: string; prima: string; flujo: string; flujo_mixta: string | null; tope_seguro: string | null };
    parametros: { RMV: string; UIT: string; ESSALUD_PCT: string; ONP_PCT: string; VIDA_LEY_PCT: string };
    ingresos_previos: string; retenciones_hasta_corte: string; gratificaciones_previas: string;
    meses_gratificacion: number; adelantos_desembolsados: string;
    bono_extraordinario: string; descuento_autorizado: string; descuento_dso: string | null;
}
export interface SalidaPlanilla {
    dias_laborados: number; sueldo_base: string; asignacion_familia: string; horas_extras_25: string; horas_extras_35: string;
    recargo_nocturno: string; gratificacion: string; bonif_extraordinaria: string;
    descuento_faltas: string; descuento_tardanzas: string; descuento_sin_goce: string;
    bono_extraordinario: string; descuento_autorizado: string; descuento_dso: string;
    descuento_onp: string; descuento_afp_fondo: string; descuento_afp_seguro: string; descuento_afp_comision: string;
    tasa_afp_aplicada: string | null; descuento_quinta: string; descuento_adelanto: string; descuento_eps: string;
    aporte_essalud: string; aporte_vida_ley: string; total_ingresos: string; total_descuentos: string; neto_a_pagar: string;
    base_essalud: string; base_previsional: string;
    version_motor: string;
}
