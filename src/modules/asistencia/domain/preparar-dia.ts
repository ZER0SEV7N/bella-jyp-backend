//src/modules/asistencia/domain/preparar-dia.ts
import { ServerTime } from '@/common/utils/server-time';
import type { ContextoAsistencia, DecisionAsistencia, MarcaDia, ResultadoDia } from './asistencia.types';

/**
 * Regla de negocio que encapsula la lógica de preparación de un día específico para la evaluación de asistencia.
 * Se encarga de validar la fecha, determinar la jornada y el horario del día, y filtrar las decisiones de asistencia relevantes.
 * Además, se generan alertas para situaciones especiales, como fechas fuera del vínculo laboral o ausencia de configuración de jornada.
 */

// Mapeo de días de la semana indexado según Date.prototype.getUTCDay() (0 = DOMINGO, 1 = LUNES, ..., 6 = SABADO).
const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

/**
 * Función que valida si un valor es una marca de asistencia válida, verificando que tenga el tipo y la hora correctos, y opcionalmente un identificador y el origen.
 * @param value - Valor a validar como marca de asistencia.
 * @returns - true si el valor es una marca de asistencia válida, false en caso contrario.
 */
function esMarcaDia(value: unknown): value is MarcaDia {
    if (!value || typeof value !== 'object') return false;

    const marca = value as Record<string, unknown>;
    const tiposValidos = ['ENTRADA', 'SALIDA_ALMUERZO', 'ENTRADA_ALMUERZO', 'SALIDA'];

    return (
        typeof marca.tipo === 'string' &&
        tiposValidos.includes(marca.tipo) &&
        typeof marca.hora === 'string' &&
        (marca.id === undefined || typeof marca.id === 'string') &&
        (marca.origen === undefined || typeof marca.origen === 'string')
    );
}

/**
 * Función que prepara la configuración de un día específico para la evaluación de asistencia,
 * validando la fecha, determinando la jornada y el horario del día, y filtrando las decisiones de asistencia relevantes.
 * @param contexto - Contexto de asistencia que incluye la fecha actual, el horario laboral y las decisiones de asistencia.
 * @param fecha - Fecha del día a evaluar en formato 'YYYY-MM-DD'.
 * @param r - Objeto ResultadoDia que representa el resultado del día, incluyendo minutos programados, minutos sin goce y estado de asistencia.
 * @returns - Objeto que contiene la configuración del día, incluyendo el horario, la jornada y las decisiones de asistencia relevantes, o null si la fecha está fuera del vínculo laboral o no hay configuración disponible.
 * @throws RangeError si la fecha no cumple con el formato 'YYYY-MM-DD' o si las marcas no son válidas.
 */
export function prepararDia(contexto: ContextoAsistencia, fecha: string, r: ResultadoDia) {
    const empleado = contexto.empleado;

    // Si la fecha de ingreso del empleado no está registrada, se agrega la alerta correspondiente y se retorna null.
    if (!empleado.fecha_inicio) {
        r.alertas.push('FECHA_DE_INGRESO_NO_REGISTRADA');
        return null;
    }

    // Si la fecha está fuera del vínculo laboral del empleado (antes del ingreso o después del cese), no aplica evaluación.
    if (fecha < empleado.fecha_inicio || (empleado.fecha_cese && fecha > empleado.fecha_cese))
        return null;

    // Obtiene la jornada histórica vigente para la fecha evaluada.
    const jornada = contexto.jornadas.filter((j) => j.desde <= fecha).at(-1);

    if (!jornada) {
        r.estado = 'PENDIENTE';
        r.alertas.push('JORNADA_HISTORICA_NO_ASIGNADA');
        return null;
    }

    // Busca el horario correspondiente al día de la semana (getUTCDay(): 0 = DOMINGO .. 6 = SABADO).
    const horario = jornada.horario.find((h) => h.dia === DIAS[ServerTime.desdeFechaSimple(fecha).getUTCDay()]);
    if (!horario) {
        r.alertas.push('HORARIO_NO_CONFIGURADO');
        return null;
    }

    r.modalidad = horario.modalidad ?? 'PRESENCIAL';

    // Si existe una decisión humana que corrige las marcaciones del día, se reemplazan previa validación estructural.
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
 * Función que evalúa si un día específico es un día de descanso o feriado, y ajusta el estado del resultado del día en consecuencia.
 * También verifica si existen solicitudes de ausencia sin goce de asistencia que afecten el estado del día.
 * @param contexto - Contexto de asistencia que incluye las solicitudes de ausencia y decisiones de asistencia.
 * @param fecha - Fecha del día a evaluar en formato 'YYYY-MM-DD'.
 * @param r - Objeto ResultadoDia que representa el resultado del día, incluyendo minutos programados, minutos sin goce y estado de asistencia.
 * @param descanso - Indica si el día es un descanso o feriado (opcional).
 * @param decisiones - Lista de decisiones de asistencia relevantes para el día.
 * @returns - Objeto ResultadoDia actualizado con el estado del día y alertas correspondientes.
 * @throws RangeError si la fecha no cumple con el formato 'YYYY-MM-DD'.
 * @throws RangeError si las marcas no son válidas.
 */
export function evaluarDescanso(contexto: ContextoAsistencia, fecha: string, r: ResultadoDia, descanso: string | undefined, decisiones: DecisionAsistencia[] ): ResultadoDia {
    // Si el día es un descanso o feriado, se ajusta el estado del resultado del día y se agregan alertas si hay marcas registradas.
    r.estado = descanso ? 'FERIADO_O_DESCANSO_ACORDADO' : 'DESCANSO_SEMANAL';
    if (r.marcas.length)
        r.alertas.push('TRABAJO_EN_DESCANSO_REQUIERE_LIQUIDACION_ESPECIFICA');

    // Se verifica si existe alguna solicitud de ausencia sin goce de asistencia que afecte el estado del día.
    const sinGoceCompleto = contexto.solicitudes.some(
        (s) =>
            s.estado === 'APROBADA' &&
            s.efecto_asistencia === 'SIN_GOCE' &&
            !s.hora_inicio &&
            s.fecha_inicio &&
            s.fecha_fin &&
            s.fecha_inicio <= fecha &&
            s.fecha_fin >= fecha,
    );

    // Si no hay marcas registradas y existe una solicitud de ausencia sin goce completa o una decisión de ausencia sin goce, se ajusta el estado del día a 'AUSENCIA_SIN_GOCE'.
    if (!r.marcas.length && (sinGoceCompleto || decisiones.some((d) => d.tipo === 'AUSENCIA' && d.datos.resultado === 'SIN_GOCE'))) {
        r.estado = 'AUSENCIA_SIN_GOCE';
        r.sin_goce = 1;
    }
    return r;
}
