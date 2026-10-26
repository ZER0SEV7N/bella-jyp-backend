//src/modules/asistencia/domain/preparar-dia.ts
import { ServerTime } from '@/common/utils/server-time';
import type { ContextoAsistencia, DecisionAsistencia, MarcaDia, ResultadoDia } from './asistencia.types';

/**
 * Regla de negocio que encapsula la lógica de preparación de un día específico para la evaluación de asistencia.
 * Se encarga de validar la fecha, determinar la jornada y el horario del día, y filtrar las decisiones de asistencia relevantes.
 * Además, se generan alertas para situaciones especiales, como fechas fuera del vínculo laboral o ausencia de configuración de jornada.
 */

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']; //Los días de la semana en español, 
//utilizados para mapear los días de la semana a sus nombres correspondientes.


/**
 * Funcion que valida si un valor es una marca de asistencia válida, verificando que tenga el tipo y la hora correctos, y opcionalmente un identificador y el origen.
 * @param value - Valor a validar como marca de asistencia.
 * @returns - true si el valor es una marca de asistencia válida, false en caso contrario.
 * @throws RangeError si el valor no cumple con los requisitos de formato o consistencia.
 */
function esMarcaDia(value: unknown): value is MarcaDia {
    //Valida que el valor sea un objeto y tenga las propiedades requeridas para ser considerado una marca de asistencia válida.
    if (!value || typeof value !== 'object') return false;

    //Convierte el valor a un objeto de tipo MarcaDia para realizar las validaciones de sus propiedades.
    const marca = value as Record<string, unknown>;
    //Define los tipos de marcación válidos y verifica que el tipo de la marca sea uno de ellos, que la hora sea una cadena 
    //y que el identificador y el origen sean opcionales y de tipo cadena si están presentes.
    const tiposValidos = ['ENTRADA', 'SALIDA_ALMUERZO', 'ENTRADA_ALMUERZO', 'SALIDA'];

    //Valida que el tipo de la marca sea uno de los tipos válidos, que la hora sea una cadena y que el identificador 
    //y el origen sean opcionales y de tipo cadena si están presentes.
    return typeof marca.tipo === 'string' && tiposValidos.includes(marca.tipo) && typeof marca.hora === 'string' &&
        (marca.id === undefined || typeof marca.id === 'string') && (marca.origen === undefined || typeof marca.origen === 'string');
}


/**
 * Funcion que prepara la configuración de un día específico para la evaluación de asistencia, 
 * validando la fecha, determinando la jornada y el horario del día, y filtrando las decisiones de asistencia relevantes.
 * @param contexto - Contexto de asistencia que incluye la fecha actual, el horario laboral y las decisiones de asistencia.
 * @param fecha - Fecha del día a evaluar en formato 'YYYY-MM-DD'.
 * @param r - Objeto ResultadoDia que representa el resultado del día, incluyendo minutos programados, minutos sin goce y estado de asistencia.
 * @returns - Objeto que contiene la configuración del día, incluyendo el horario, la jornada y las decisiones de asistencia relevantes, o null si la fecha está fuera del vínculo laboral o no hay configuración disponible.
 * @throws RangeError si la fecha no cumple con el formato 'YYYY-MM-DD' o si las marcas no son válidas.
 * @throws ConflictException si la fecha de ingreso del empleado no está registrada.
 * @throws ConflictException si no hay una jornada histórica asignada para la fecha.
 * @throws ConflictException si no hay un horario configurado para el día.
 */
export function prepararDia(contexto: ContextoAsistencia, fecha: string, r: ResultadoDia) {
    //Valida que la fecha tenga el formato 'YYYY-MM-DD' antes de continuar con la preparación del día.
    const empleado = contexto.empleado;

    //Si la fecha de ingreso del empleado no está registrada, 
    //se agrega una alerta indicando que la fecha de ingreso no está registrada y se devuelve null.
    if (!empleado.fecha_inicio) {
        r.alertas.push('FECHA_DE_INGRESO_NO_REGISTRADA');
        return null;
    }

    //Si la fecha está fuera del vínculo laboral del empleado (antes de la fecha de ingreso o después de la fecha de cese),
    //se devuelve null indicando que no hay configuración disponible para el día.
    if (fecha < empleado.fecha_inicio || (empleado.fecha_cese && fecha > empleado.fecha_cese)) 
        return null;
    
    //Filtra las jornadas del empleado que son válidas para la fecha actual, considerando la fecha de inicio de cada jornada.
    const jornada = contexto.jornadas.filter((j) => j.desde <= fecha).at(-1);

    //Si no hay una jornada histórica asignada para la fecha, se agrega una alerta y se devuelve null.
    if (!jornada) {
        r.estado = 'PENDIENTE';
        r.alertas.push('JORNADA_HISTORICA_NO_ASIGNADA');
        return null;
    }

    //Busca el horario correspondiente al día de la semana de la fecha actual dentro de la jornada histórica del empleado.
    const horario = jornada.horario.find((h) => h.dia === DIAS[ServerTime.desdeFechaSimple(fecha).getUTCDay()]);
    if (!horario) {
        r.alertas.push('HORARIO_NO_CONFIGURADO');
        return null;
    }

    //Filtra las decisiones de asistencia que son relevantes para la fecha actual, considerando el tipo de decisión y la fecha.
    r.modalidad = horario.modalidad ?? 'PRESENCIAL';

    //Si hay una corrección de marcaciones para la fecha actual, se actualizan las marcas en el objeto ResultadoDia con las marcas corregidas.
    const decisiones = contexto.decisiones.filter((d) => d.fecha === r.fecha);
    const correccion = decisiones.find((d) => d.tipo === 'MARCACIONES');
    if (correccion) {
        const marcaciones = correccion.datos.marcaciones;
        if (!Array.isArray(marcaciones) || !marcaciones.every(esMarcaDia)) {
            throw new RangeError('Las marcaciones de la decisión no tienen un formato válido.');
        }
        r.marcas = marcaciones;
    }

    return { horario, jornada, decisiones };
}

/**
 * Función que evalúa la asistencia de un empleado para un día específico, considerando el contexto de asistencia, las marcas registradas y los descansos.
 * Coordina la evaluación de ausencias, descansos y marcaciones, aplicando las decisiones de asistencia y las solicitudes aprobadas.
 * @param contexto - Contexto de asistencia que incluye la fecha actual, el horario laboral y las decisiones de asistencia.
 * @param fecha - Fecha del día a evaluar en formato 'YYYY-MM-DD'.
 * @param marcas - Arreglo de marcas de asistencia registradas para el día.
 * @param descansos - Mapa que asocia fechas con los tipos de descanso correspondientes (por ejemplo, feriados o días libres).
 * @returns - Objeto ResultadoDia actualizado con el estado final de asistencia, minutos trabajados y cualquier alerta generada.
 * @throws RangeError si la fecha no cumple con el formato 'YYYY-MM-DD' o si las marcas no son válidas.
 */
export function evaluarDescanso(contexto: ContextoAsistencia, fecha: string, r: ResultadoDia, descanso: string | undefined, decisiones: DecisionAsistencia[]): ResultadoDia {
    //Si el día es un descanso o feriado, se evalúa como tal y se devuelve el resultado actualizado.
    r.estado = descanso ? 'FERIADO_O_DESCANSO_ACORDADO' : 'DESCANSO_SEMANAL';
    //Si hay marcas registradas para el día, se agrega una alerta indicando que se requiere una liquidación específica para el trabajo en descanso.
    if (r.marcas.length) 
        r.alertas.push('TRABAJO_EN_DESCANSO_REQUIERE_LIQUIDACION_ESPECIFICA');

    //Si no hay marcas registradas y hay una ausencia sin goce de sueldo para el día, 
    // se actualiza el estado a 'AUSENCIA_SIN_GOCE' y se incrementa el contador de días sin goce.
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

    //Si no hay marcas registradas y hay una ausencia sin goce de sueldo para el día,
    if (!r.marcas.length && (sinGoceCompleto || decisiones.some((d) => d.tipo === 'AUSENCIA' && d.datos.resultado === 'SIN_GOCE'))) {
        r.estado = 'AUSENCIA_SIN_GOCE';
        r.sin_goce = 1;
    }
    return r;
}
