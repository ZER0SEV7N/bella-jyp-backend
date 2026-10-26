//src/modules/asistencia/domain/evaluar-dia.ts
import { validarJornadaRegular } from './validar-jornada';
import { ServerTime } from '@/common/utils/server-time';
import type { ContextoAsistencia, MarcaDia, ResultadoDia } from './asistencia.types';
import { evaluarAusencia } from './evaluar-ausencia';
import { evaluarMarcaciones } from './evaluar-marcaciones';
import { duracion, horarioProgramado, restar } from './intervalos-asistencia';
import { aplicarDecisionAusencia, prepararJustificaciones } from './justificaciones-dia';
import { evaluarDescanso, prepararDia } from './preparar-dia';

/**
 * Regla de negocio que encapsula la lógica de evaluación diaria de asistencia, separando programación, sustento y marcaciones.
 * Coordina la evaluación de ausencias, descansos y marcaciones, considerando las decisiones de asistencia y las solicitudes aprobadas.
 */

/**
 * Crea un objeto ResultadoDia inicializado con los valores predeterminados para un día específico, incluyendo la fecha y las marcas de asistencia.
 * @param fecha - Fecha del día a evaluar en formato 'YYYY-MM-DD'.
 * @param marcas - Arreglo de marcas de asistencia registradas para el día.
 * @returns - Objeto ResultadoDia inicializado con valores predeterminados, listo para ser evaluado.
 * @throws RangeError si la fecha no cumple con el formato 'YYYY-MM-DD' o si las marcas no son válidas.
 */
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
    alertas: [],
  };
}

/**
 * Evalúa la asistencia de un empleado para un día específico, considerando el contexto de asistencia, las marcas registradas y los descansos.
 * Coordina la evaluación de ausencias, descansos y marcaciones, aplicando las decisiones de asistencia y las solicitudes aprobadas.
 * @param contexto - Contexto de asistencia que incluye la fecha actual, el horario laboral y las decisiones de asistencia.
 * @param fecha - Fecha del día a evaluar en formato 'YYYY-MM-DD'.
 * @param marcas - Arreglo de marcas de asistencia registradas para el día.
 * @param descansos - Mapa que asocia fechas con los tipos de descanso correspondientes (por ejemplo, feriados o días libres).
 * @returns - Objeto ResultadoDia actualizado con el estado final de asistencia, minutos trabajados y cualquier alerta generada.
 * @throws RangeError si la fecha no cumple con el formato 'YYYY-MM-DD' o si las marcas no son válidas.
 */
    export function evaluarFecha(contexto: ContextoAsistencia, fecha: string, marcas: MarcaDia[], descansos: Map<string, string> ): ResultadoDia {
    //Valida que la fecha tenga el formato 'YYYY-MM-DD' antes de continuar con la evaluación.
    const r = crearResultadoDia(fecha, marcas);
    const configuracion = prepararDia(contexto, fecha, r);

    //Si no hay configuración para el día (por ejemplo, si es un día fuera del vínculo laboral), se devuelve el resultado inicial sin cambios.
    if (!configuracion) return r;

    //Si el día es un descanso o feriado, se evalúa como tal y se devuelve el resultado actualizado.
    const { horario, jornada, decisiones } = configuracion;
    const descanso = descansos.get(fecha);

    //Si el día no es laborable o es un descanso, se evalúa como tal y se devuelve el resultado actualizado.
    if (!horario.laborable || descanso) return evaluarDescanso(contexto, fecha, r, descanso, decisiones);

    //Si el día es laborable, se evalúa la asistencia considerando el horario programado, las ausencias y las marcaciones.
    const programado = horarioProgramado(horario);
    let jornadaSoportada = true;
    
    //Valida que la jornada laboral cumpla con las reglas de negocio para jornadas de 40 o 48 horas semanales, y marca el día como pendiente si no es soportada.
    try {
        validarJornadaRegular(jornada.horario, jornada.minutos_semana);
    } catch {
        jornadaSoportada = false;
    }

    //Si no hay horario programado o la jornada no es soportada, se marca el día como pendiente y se agrega una alerta correspondiente.
    if (!programado || !jornadaSoportada) {
        r.estado = 'PENDIENTE';
        r.alertas.push('JORNADA_NO_SOPORTADA_POR_EL_ALCANCE_DE_40_O_48_HORAS');
        return r;
    }

    //Calcula los minutos programados para el día según el horario laboral y las ausencias registradas.
    r.minutos_programados = duracion(programado);
    //Una jornada que todavía no terminó no puede convertirse en una ausencia definitiva.
    if (new Date(contexto.ahora) < ServerTime.desdeHoraPeru(fecha, horario.salida)) {
        r.estado = 'NO_EVALUADO';
        return r;
    }

    //Prepara las justificaciones de ausencias y faltas, aplicando las decisiones de asistencia y considerando las solicitudes aprobadas.
    const { aprobadas, conGoce, sinGoce } = prepararJustificaciones(contexto, fecha, r);
    //Aplica las decisiones de asistencia para determinar si hay ausencias con goce, sin goce o faltas injustificadas.
    const ausencia = aplicarDecisionAusencia(decisiones, r, conGoce, sinGoce);
    //Calcula los minutos sin goce considerando las ausencias con goce y sin goce, y actualiza el resultado del día en consecuencia.
    const programadoSinGoce = restar(programado, conGoce);
    //Calcula los minutos sin goce considerando las ausencias con goce y sin goce, y actualiza el resultado del día en consecuencia.
    r.minutos_sin_goce = duracion(programadoSinGoce) - duracion(restar(programadoSinGoce, sinGoce));

    //Si no hay marcas registradas para el día, se evalúa la ausencia directamente y se devuelve el resultado actualizado.
    if (!r.marcas.length) return evaluarAusencia(r, programado, conGoce, sinGoce, ausencia, aprobadas);

    //Si hay marcas registradas, se evalúan las marcaciones considerando el horario laboral, las ausencias y las solicitudes aprobadas.
    return evaluarMarcaciones(r, horario, jornada, decisiones, programado, conGoce, sinGoce, aprobadas);
}
