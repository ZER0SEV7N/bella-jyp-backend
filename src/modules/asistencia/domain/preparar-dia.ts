import { ServerTime } from '@/common/utils/server-time';
import type { ContextoAsistencia, DecisionAsistencia, MarcaDia, ResultadoDia } from './asistencia.types';

const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

/** Selecciona el vínculo y el horario históricos antes de evaluar las marcas del día. */
export function prepararDia(contexto: ContextoAsistencia, fecha: string, r: ResultadoDia) {
    const empleado = contexto.empleado;
    if (!empleado.fecha_inicio) {
        r.alertas.push('FECHA_DE_INGRESO_NO_REGISTRADA');
        return null;
    }
    if (fecha < empleado.fecha_inicio || (empleado.fecha_cese && fecha > empleado.fecha_cese)) return null;
    const jornada = contexto.jornadas.filter((j) => j.desde <= fecha).at(-1);
    if (!jornada) {
        r.estado = 'PENDIENTE';
        r.alertas.push('JORNADA_HISTORICA_NO_ASIGNADA');
        return null;
    }
    const horario = jornada.horario.find((h) => h.dia === DIAS[ServerTime.desdeFechaSimple(fecha).getUTCDay()]);
    if (!horario) {
        r.alertas.push('HORARIO_NO_CONFIGURADO');
        return null;
    }
    r.modalidad = horario.modalidad ?? 'PRESENCIAL';
    const decisiones = contexto.decisiones.filter((d) => d.fecha === r.fecha);
    const correccion = decisiones.find((d) => d.tipo === 'MARCACIONES');
    if (correccion) r.marcas = correccion.datos.marcaciones as unknown as MarcaDia[];

    return { horario, jornada, decisiones };
}

/** El descanso se distingue de una ausencia y no se liquida automáticamente si hubo trabajo. */
export function evaluarDescanso(contexto: ContextoAsistencia, fecha: string, r: ResultadoDia, descanso: string | undefined, decisiones: DecisionAsistencia[]): ResultadoDia {
    r.estado = descanso ? 'FERIADO_O_DESCANSO_ACORDADO' : 'DESCANSO_SEMANAL';
    if (r.marcas.length) r.alertas.push('TRABAJO_EN_DESCANSO_REQUIERE_LIQUIDACION_ESPECIFICA');
    const sinGoceCompleto = contexto.solicitudes.some(
        (s) =>
            s.estado === 'APROBADA' &&
            s.efecto_asistencia === 'SIN_GOCE' &&
            !s.hora_inicio &&
            s.fecha_inicio &&
            s.fecha_fin &&
            s.fecha_inicio <= fecha &&
            s.fecha_fin >= fecha
    );
    if (!r.marcas.length && (sinGoceCompleto || decisiones.some((d) => d.tipo === 'AUSENCIA' && d.datos.resultado === 'SIN_GOCE'))) {
        r.estado = 'AUSENCIA_SIN_GOCE';
        r.sin_goce = 1;
    }
    return r;
}
