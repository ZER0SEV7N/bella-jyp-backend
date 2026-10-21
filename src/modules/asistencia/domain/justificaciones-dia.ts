//src/modules/asistencia/domain/justificaciones-dia.ts
import type { ContextoAsistencia, DecisionAsistencia, ResultadoDia } from './asistencia.types';
import type { Intervalo } from './intervalos-asistencia';
import { duracion, restar } from './intervalos-asistencia';
import { diasMedicosAcumulados, intervaloSolicitud } from './solicitudes-asistencia';

/**
 * Regla de negocio que encapsula la lógica de preparación y aplicación de justificaciones de asistencia para un día específico.
 * Se encarga de filtrar las solicitudes de asistencia relevantes, clasificar los intervalos de tiempo según el efecto de la solicitud y aplicar las decisiones de asistencia.
 * Además, se generan alertas para situaciones especiales, como solicitudes pendientes, límites de días médicos y efectos superpuestos.
 */

/**
 * Prepara las justificaciones de asistencia para un día específico, filtrando las solicitudes relevantes y 
 * clasificando los intervalos de tiempo según el efecto de la solicitud.
 * @param contexto - Contexto de asistencia que incluye las solicitudes de asistencia y la fecha actual.
 * @param fecha - Fecha del día a evaluar en formato 'YYYY-MM-DD'.
 * @param r - Objeto ResultadoDia que representa el resultado del día, incluyendo minutos programados, minutos sin goce y estado de asistencia.
 * @returns - Objeto que contiene las solicitudes aprobadas, los intervalos de tiempo con goce y sin goce, y cualquier alerta generada durante la preparación de justificaciones.
 * @throws RangeError si los intervalos de tiempo no son válidos o si los datos de entrada no cumplen con los requisitos de formato o consistencia.
 */
export function prepararJustificaciones(contexto: ContextoAsistencia, fecha: string, r: ResultadoDia) {
    //Filtra las solicitudes de asistencia que son relevantes para la fecha actual, considerando el rango de fechas de inicio y fin.
    const solicitudes = contexto.solicitudes.filter((s) => s.fecha_inicio && s.fecha_fin && s.fecha_inicio <= fecha && s.fecha_fin >= fecha);
    //Actualiza el objeto ResultadoDia con los IDs de las solicitudes relevantes y genera alertas si hay solicitudes pendientes o en revisión.
    r.solicitudes = solicitudes.map((s) => s.id);
    //Si hay solicitudes pendientes o en revisión, se agrega una alerta indicando que la solicitud requiere resolución.
    if (solicitudes.some((s) => ['PENDIENTE', 'EN_REVISION'].includes(s.estado))) 
        r.alertas.push('SOLICITUD_PENDIENTE_DE_RESOLUCION');
    
    //Filtra las solicitudes aprobadas.
    const aprobadas = solicitudes.filter((s) => s.estado === 'APROBADA');

    //Clasifica los intervalos de tiempo según el efecto de la solicitud, separando los intervalos con goce y sin goce.
    const conGoce: Intervalo[] = [], sinGoce: Intervalo[] = [];
    
    //Itera sobre las solicitudes aprobadas y clasifica los intervalos de tiempo según el efecto de la solicitud, 
    //actualizando los arreglos conGoce y sinGoce.
    for (const s of aprobadas) {
        const efecto = s.tipo === 'VACACIONES' ? 'CON_GOCE' : s.efecto_asistencia;
        //Si la solicitud es de licencia médica con goce y se ha superado el límite anual de 20 días médicos, se agrega una alerta indicando que se ha superado el límite.
        if (s.tipo === 'LICENCIA_MEDICA' && efecto === 'CON_GOCE' && diasMedicosAcumulados(contexto.solicitudes, fecha) > 20){
            r.alertas.push('LIMITE_ANUAL_DE_VEINTE_DIAS_MEDICOS_SUPERADO');
        }

        //Clasifica los intervalos de tiempo según el efecto de la solicitud, 
        //agregando los intervalos correspondientes a los arreglos conGoce y sinGoce.
        if (efecto === 'CON_GOCE') 
            conGoce.push(intervaloSolicitud(s));
        else if (efecto === 'SIN_GOCE') 
            sinGoce.push(intervaloSolicitud(s));
        else 
            r.alertas.push(alertaEfecto(efecto));
    }

    //Si los intervalos de tiempo con goce y sin goce se superponen, se agrega una alerta indicando que hay justificaciones con efectos superpuestos.
    if (duracion(restar(sinGoce, conGoce)) !== duracion(sinGoce)) r.alertas.push('JUSTIFICACIONES_CON_EFECTOS_SUPERPUESTOS');

    return { aprobadas, conGoce, sinGoce };
}

/**
 * Aplica las decisiones de asistencia relacionadas con la ausencia para un día específico, actualizando el objeto ResultadoDia con el estado final de asistencia y cualquier alerta generada.
 * @param decisiones - Arreglo de decisiones de asistencia que pueden incluir decisiones relacionadas con ausencias y permisos.
 * @param r - Objeto ResultadoDia que representa el resultado del día, incluyendo minutos programados, minutos sin goce y estado de asistencia.
 * @param conGoce - Arreglo de intervalos que representan las ausencias con goce de sueldo para el día.
 * @param sinGoce - Arreglo de intervalos que representan las ausencias sin goce de sueldo para el día.
 * @returns - Objeto actualizado que representa el resultado del día después de aplicar las decisiones de ausencia, incluyendo el estado final de asistencia y cualquier alerta generada.
 * @throws RangeError si los intervalos de tiempo no son válidos o si los datos de entrada no cumplen con los requisitos de formato o consistencia.
 */
export function aplicarDecisionAusencia(decisiones: DecisionAsistencia[], r: ResultadoDia, conGoce: Intervalo[], sinGoce: Intervalo[]) {
    //Busca una decisión de asistencia del tipo 'AUSENCIA' en el arreglo de decisiones,
    //que puede indicar la presencia de una ausencia con goce, sin goce o una interrupción técnica.
    const ausencia = decisiones.find((d) => d.tipo === 'AUSENCIA');
    
    //Si hay una decisión de ausencia y hay marcas registradas para el día, 
    //se agrega una alerta indicando que la decisión de ausencia es incompatible con las marcaciones.
    if (ausencia && r.marcas.length) 
        r.alertas.push('DECISION_DE_AUSENCIA_INCOMPATIBLE_CON_MARCACIONES');
    if (ausencia?.datos.resultado === 'CON_GOCE' || ausencia?.datos.resultado === 'INTERRUPCION_TECNICA') 
        conGoce.push([0, 1440]);
    if (ausencia?.datos.resultado === 'SIN_GOCE') 
        sinGoce.push([0, 1440]);

    return ausencia;
}

//Función auxiliar que genera una alerta específica según el efecto de la solicitud de asistencia, 
//indicando si se requiere una liquidación específica o si no hay un efecto remunerativo definido.
function alertaEfecto(efecto: string): string { return efecto === 'SUBSIDIO' ? 'SUBSIDIO_REQUIERE_LIQUIDACION_ESPECIFICA' : 'SOLICITUD_SIN_EFECTO_REMUNERATIVO_DEFINIDO';}
