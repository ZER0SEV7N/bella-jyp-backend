//src/modules/asistencia/domain/solicitudes-asistencia.ts
import { ServerTime } from '@/common/utils/server-time';
import type { SolicitudAsistencia } from './asistencia.types';
import type { Intervalo } from './intervalos-asistencia';
import { minutos } from './intervalos-asistencia';

/**
 * Funcion de dominio que calcula el intervalo de tiempo de una solicitud de asistencia, considerando la hora de inicio y fin de la solicitud.
 * Si la solicitud no tiene horas definidas, se asume que cubre todo el día (00:00 a 24:00).
 */

/**
 * Calcula el intervalo de tiempo de una solicitud de asistencia, considerando la hora de inicio y fin de la solicitud.
 * Si la solicitud no tiene horas definidas, se asume que cubre todo el día (00:00 a 24:00).
 * @param solicitud - Objeto que representa la solicitud de asistencia, incluyendo la hora de inicio y fin.
 * @returns - Un arreglo de dos números que representan el inicio y fin del intervalo en minutos desde la medianoche.
 * @throws Error si la solicitud no es válida o si las horas no cumplen con el formato esperado.
 */
export function intervaloSolicitud(solicitud: SolicitudAsistencia): Intervalo {
    return solicitud.hora_inicio && solicitud.hora_fin ? [minutos(solicitud.hora_inicio), minutos(solicitud.hora_fin)] : [0, 1440];
}

/**
 * Calcula el número de días médicos acumulados para un empleado en una fecha específica.
 * @param solicitudes - Arreglo de solicitudes de asistencia.
 * @param fecha - Fecha para la cual se calculan los días médicos.
 * @returns - Número de días médicos acumulados.
 */
export function diasMedicosAcumulados(solicitudes: SolicitudAsistencia[], fecha: string): number {
    //Crea un conjunto para almacenar los días médicos únicos, comenzando desde el 1 de enero del año de la fecha proporcionada.
    const dias = new Set<string>(), enero = `${fecha.slice(0, 4)}-01-01`;

    //Itera sobre las solicitudes de asistencia filtrando aquellas que sean de tipo 'LICENCIA_MEDICA', estén aprobadas y tengan fechas de inicio y fin definidas.
    for (const s of solicitudes.filter((s) => s.tipo === 'LICENCIA_MEDICA' && s.estado === 'APROBADA' && s.fecha_inicio && s.fecha_fin)) {
        //Calcula el rango de fechas que abarca la solicitud, ajustando la fecha de inicio al 1 de enero si es anterior y la fecha de fin a la fecha proporcionada si es posterior.
        const inicio = s.fecha_inicio < enero ? enero : s.fecha_inicio,
            fin = s.fecha_fin > fecha ? fecha : s.fecha_fin;
        
        //Si la fecha de inicio es menor que el 1 de enero del año de la fecha proporcionada, se ajusta al 1 de enero; si la fecha de fin es mayor que la fecha proporcionada, se ajusta a la fecha proporcionada.
        for (let cursor = ServerTime.desdeFechaSimple(inicio); cursor.toISOString().slice(0, 10) <= fin; cursor.setUTCDate(cursor.getUTCDate() + 1))
            dias.add(cursor.toISOString().slice(0, 10));
    }
    return dias.size;
}
