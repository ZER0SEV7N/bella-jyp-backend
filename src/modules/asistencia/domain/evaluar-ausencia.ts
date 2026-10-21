//src/modules/asistencia/domain/evaluar-ausencia.ts
import type { DecisionAsistencia, ResultadoDia, SolicitudAsistencia } from './asistencia.types';
import type { Intervalo } from './intervalos-asistencia';
import { duracion, restar } from './intervalos-asistencia';

/**
 * Regla de negocio que encapsula la lógica de evaluación de ausencias y faltas en el sistema de asistencia.
 * Separa la evaluación de ausencias con goce, sin goce y faltas injustificadas, considerando las solicitudes aprobadas y las decisiones de asistencia.
 * @param r - Objeto que representa el resultado del día, incluyendo minutos programados, minutos sin goce y estado de asistencia.
 * @param programado - Arreglo de intervalos que representan el horario programado del trabajador para el día.
 * @param conGoce - Arreglo de intervalos que representan las ausencias con goce de sueldo para el día.
 * @param sinGoce - Arreglo de intervalos que representan las ausencias sin goce de sueldo para el día.
 * @param ausencia - Objeto que representa la decisión de asistencia para el día, incluyendo el resultado de la evaluación de ausencias.
 * @param aprobadas - Arreglo de solicitudes de asistencia aprobadas para el día, que pueden afectar la evaluación de ausencias y faltas.
 * @returns - Objeto actualizado que representa el resultado del día después de evaluar las ausencias y faltas, incluyendo el estado final de asistencia y cualquier alerta generada.
 * @throws RangeError si los intervalos de tiempo no son válidos o si los datos de entrada no cumplen con los requisitos de formato o consistencia.
 */
export function evaluarAusencia(r: ResultadoDia, programado: Intervalo[], conGoce: Intervalo[], sinGoce: Intervalo[], ausencia: DecisionAsistencia | undefined, aprobadas: SolicitudAsistencia[]): ResultadoDia {
    if (duracion(restar(programado, [...conGoce, ...sinGoce])) === 0) {
        r.sin_goce = r.minutos_sin_goce === r.minutos_programados ? 1 : 0;
        if (r.sin_goce) r.minutos_sin_goce = 0;
        r.estado = r.sin_goce ? 'AUSENCIA_SIN_GOCE' : 'JUSTIFICADA';
    } else if (ausencia?.datos.resultado === 'FALTA_INJUSTIFICADA' && !aprobadas.length) {
        r.falta = 1;
        r.minutos_sin_goce = 0;
        r.estado = 'FALTA_INJUSTIFICADA';
    } else {
        r.estado = 'AUSENCIA_PENDIENTE';
        r.alertas.push('AUSENCIA_REQUIERE_VERIFICACION');
    }
    return r;
}
