import { ServerTime } from '@/common/utils/server-time';
import type { ContextoAsistencia, MarcaDia, ResultadoDia } from './asistencia.types';
import { evaluarAusencia } from './evaluar-ausencia';
import { evaluarMarcaciones } from './evaluar-marcaciones';
import { duracion, horarioProgramado, restar } from './intervalos-asistencia';
import { aplicarDecisionAusencia, prepararJustificaciones } from './justificaciones-dia';
import { evaluarDescanso, prepararDia } from './preparar-dia';

function crearResultadoDia(fecha: string, marcas: MarcaDia[]): ResultadoDia {
    return {
        fecha,
        estado: 'FUERA_DE_VINCULO',
        modalidad: null,
        marcas,
        solicitudes: [],
        minutos_programados: 0,
        minutos_trabajados: 0,
        minutos_tardanza: 0,
        minutos_salida_anticipada: 0,
        minutos_sin_goce: 0,
        minutos_extra_observados: 0,
        minutos_extra_25: 0,
        minutos_extra_35: 0,
        falta: 0,
        sin_goce: 0,
        alertas: []
    };
}

/** Coordina la evaluación diaria manteniendo separadas programación, sustento y marcaciones. */
export function evaluarFecha(contexto: ContextoAsistencia, fecha: string, marcas: MarcaDia[], descansos: Map<string, string>): ResultadoDia {
    const r = crearResultadoDia(fecha, marcas);
    const configuracion = prepararDia(contexto, fecha, r);
    if (!configuracion) return r;
    const { horario, jornada, decisiones } = configuracion;
    const descanso = descansos.get(fecha);
    if (!horario.laborable || descanso) return evaluarDescanso(contexto, fecha, r, descanso, decisiones);
    const programado = horarioProgramado(horario);
    if (!programado || jornada.minutos_semana !== 2400) {
        r.estado = 'PENDIENTE';
        r.alertas.push('JORNADA_NO_SOPORTADA_POR_EL_ALCANCE_DE_40_HORAS');
        return r;
    }
    r.minutos_programados = duracion(programado);
    //Una jornada que todavía no terminó no puede convertirse en una ausencia definitiva.
    if (new Date(contexto.ahora) < ServerTime.desdeHoraPeru(fecha, horario.salida!)) {
        r.estado = 'NO_EVALUADO';
        return r;
    }

    const { aprobadas, conGoce, sinGoce } = prepararJustificaciones(contexto, fecha, r);
    const ausencia = aplicarDecisionAusencia(decisiones, r, conGoce, sinGoce);
    const programadoSinGoce = restar(programado, conGoce);
    r.minutos_sin_goce = duracion(programadoSinGoce) - duracion(restar(programadoSinGoce, sinGoce));

    if (!r.marcas.length) return evaluarAusencia(r, programado, conGoce, sinGoce, ausencia, aprobadas);
    return evaluarMarcaciones(r, horario, jornada, decisiones, programado, conGoce, sinGoce, aprobadas);
}
