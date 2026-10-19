import { ServerTime } from '@/common/utils/server-time';
import type { SolicitudAsistencia } from './asistencia.types';
import type { Intervalo } from './intervalos-asistencia';
import { minutos } from './intervalos-asistencia';

export function intervaloSolicitud(solicitud: SolicitudAsistencia): Intervalo {
    return solicitud.hora_inicio && solicitud.hora_fin ? [minutos(solicitud.hora_inicio), minutos(solicitud.hora_fin)] : [0, 1440];
}

/** El límite del empleador acumula días calendario únicos del año, también fuera del mes calculado. */
export function diasMedicosAcumulados(solicitudes: SolicitudAsistencia[], fecha: string): number {
    const dias = new Set<string>(),
        enero = `${fecha.slice(0, 4)}-01-01`;
    for (const s of solicitudes.filter((s) => s.tipo === 'LICENCIA_MEDICA' && s.estado === 'APROBADA' && s.fecha_inicio && s.fecha_fin)) {
        const inicio = s.fecha_inicio! < enero ? enero : s.fecha_inicio!,
            fin = s.fecha_fin! > fecha ? fecha : s.fecha_fin!;
        for (let cursor = ServerTime.desdeFechaSimple(inicio); cursor.toISOString().slice(0, 10) <= fin; cursor.setUTCDate(cursor.getUTCDate() + 1))
            dias.add(cursor.toISOString().slice(0, 10));
    }
    return dias.size;
}
