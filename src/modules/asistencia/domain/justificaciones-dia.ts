import type { ContextoAsistencia, DecisionAsistencia, ResultadoDia } from './asistencia.types';
import type { Intervalo } from './intervalos-asistencia';
import { duracion, restar } from './intervalos-asistencia';
import { diasMedicosAcumulados, intervaloSolicitud } from './solicitudes-asistencia';

/** Reúne permisos por intervalo y detecta conflictos de efecto remunerativo. */
export function prepararJustificaciones(contexto: ContextoAsistencia, fecha: string, r: ResultadoDia) {
    const solicitudes = contexto.solicitudes.filter((s) => s.fecha_inicio && s.fecha_fin && s.fecha_inicio <= fecha && s.fecha_fin >= fecha);
    r.solicitudes = solicitudes.map((s) => s.id);
    if (solicitudes.some((s) => ['PENDIENTE', 'EN_REVISION'].includes(s.estado))) r.alertas.push('SOLICITUD_PENDIENTE_DE_RESOLUCION');
    const aprobadas = solicitudes.filter((s) => s.estado === 'APROBADA');
    const conGoce: Intervalo[] = [],
        sinGoce: Intervalo[] = [];
    for (const s of aprobadas) {
        const efecto = s.tipo === 'VACACIONES' ? 'CON_GOCE' : s.efecto_asistencia;
        if (s.tipo === 'LICENCIA_MEDICA' && efecto === 'CON_GOCE' && diasMedicosAcumulados(contexto.solicitudes, fecha) > 20)
            r.alertas.push('LIMITE_ANUAL_DE_VEINTE_DIAS_MEDICOS_SUPERADO');
        if (efecto === 'CON_GOCE') conGoce.push(intervaloSolicitud(s));
        else if (efecto === 'SIN_GOCE') sinGoce.push(intervaloSolicitud(s));
        else r.alertas.push(alertaEfecto(efecto));
    }
    if (duracion(restar(sinGoce, conGoce)) !== duracion(sinGoce)) r.alertas.push('JUSTIFICACIONES_CON_EFECTOS_SUPERPUESTOS');

    return { aprobadas, conGoce, sinGoce };
}

/** Una decisión complementa el sustento original y conserva la incompatibilidad con marcas. */
export function aplicarDecisionAusencia(decisiones: DecisionAsistencia[], r: ResultadoDia, conGoce: Intervalo[], sinGoce: Intervalo[]) {
    const ausencia = decisiones.find((d) => d.tipo === 'AUSENCIA');
    if (ausencia && r.marcas.length) r.alertas.push('DECISION_DE_AUSENCIA_INCOMPATIBLE_CON_MARCACIONES');
    if (ausencia?.datos.resultado === 'CON_GOCE' || ausencia?.datos.resultado === 'INTERRUPCION_TECNICA') conGoce.push([0, 1440]);
    if (ausencia?.datos.resultado === 'SIN_GOCE') sinGoce.push([0, 1440]);

    return ausencia;
}

function alertaEfecto(efecto: string): string {
    return efecto === 'SUBSIDIO' ? 'SUBSIDIO_REQUIERE_LIQUIDACION_ESPECIFICA' : 'SOLICITUD_SIN_EFECTO_REMUNERATIVO_DEFINIDO';
}
