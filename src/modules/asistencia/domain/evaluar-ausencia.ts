import type { DecisionAsistencia, ResultadoDia, SolicitudAsistencia } from './asistencia.types';
import type { Intervalo } from './intervalos-asistencia';
import { duracion, restar } from './intervalos-asistencia';

/** Clasifica ausencia verificada, justificación completa o pendiente sin inventar marcas. */
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
