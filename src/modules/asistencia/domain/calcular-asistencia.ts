//src/modules/asistencia/domain/calcular-asistencia.ts
import { ServerTime } from '../../../common/utils/server-time';
import type { ContextoAsistencia, MarcaDia, ResultadoAsistencia, ResultadoDia } from './asistencia.types';
import { feriadosNacionalesPeru } from './calendario-peru';
import { evaluarFecha } from './evaluar-dia';
import { diasMedicosAcumulados } from './solicitudes-asistencia';

/**
 * Este archivo contiene la lógica principal para calcular la asistencia de un empleado en un período determinado.
 * La función `calcularAsistencia` toma un contexto de asistencia y devuelve un resultado detallado de la asistencia,
 * incluyendo días trabajados, faltas, minutos de tardanza, minutos extra, alertas y más.
 * 
 * También se incluyen funciones auxiliares como `diasDeVinculo` para calcular los días de vínculo del empleado
 * en el período especificado.
 * 
 * La versión del motor de asistencia se define en la constante `VERSION_MOTOR_ASISTENCIA`.
 * 
 * Este módulo es determinista y no depende del reloj, la base de datos ni Redis, garantizando resultados consistentes
 * para el mismo contexto de entrada.
 * 
 * Los tipos y estructuras de datos utilizados en este módulo se definen en `asistencia.types.ts`.
 * 
 * @module asistencia
 * @version 2026-10-21.1
 * @author Equipo de Desarrollo de Bella Planillas
 * @license MIT
 * 
 * @see {@link ContextoAsistencia} para la estructura del contexto de entrada.
 * @see {@link ResultadoAsistencia} para la estructura del resultado de salida.
 * @see {@link ResultadoDia} para la estructura del detalle diario de asistencia.
 */

export const VERSION_MOTOR_ASISTENCIA = '2026-10-21.1'; //Fecha de la versión del motor de asistencia

/**
 * Funcion que calcula los días de vínculo de un empleado en un período determinado.
 * @param inicio - Fecha de inicio del vínculo del empleado (YYYY-MM-DD).
 * @param cese - Fecha de cese del vínculo del empleado (YYYY-MM-DD) o null si aún está activo.
 * @param periodo - Período de evaluación (YYYY-MM).
 * @returns - Número de días de vínculo del empleado en el período especificado.
 * 
 * Esta función determina los días de vínculo del empleado considerando la fecha de inicio, la fecha de cese
 * y el período de evaluación. Se asegura de que los días calculados estén dentro del rango del período y
 * no excedan los 30 días.
 * 
 * @example
 * // Calcular días de vínculo para un empleado con inicio el 2026-10-01 y cese el 2026-10-15 en el período 2026-10
 * const dias = diasDeVinculo('2026-10-01', '2026-10-15', '2026-10'); // Retorna 15
 */
export function diasDeVinculo(inicio: string, cese: string | null, periodo: string): number {
    //Validar el período y obtener el año y mes correspondientes
    const { year, month } = ServerTime.validarPeriodo(periodo);
    //Calcular el primer y último día del período
    const primero = `${periodo}-01`, ultimo = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    //Determinar el rango de días de vínculo considerando la fecha de inicio, cese y el período
    const desde = inicio > primero ? inicio : primero, hasta = cese && cese < ultimo ? cese : ultimo;
    //Si el rango es inválido, retornar 0 días de vínculo
    if (desde > hasta) 
        return 0;
    
    //Si el rango coincide con todo el período, retornar 30 días de vínculo
    if (desde === primero && hasta === ultimo) 
        return 30;

    //Calcular los días de vínculo entre las fechas determinadas
    return Math.min(30, Math.round((ServerTime.desdeFechaSimple(hasta).getTime() - ServerTime.desdeFechaSimple(desde).getTime()) / 86400000) + 1);
}

/**
 * Función principal para calcular la asistencia de un empleado en un período determinado.
 * @param contexto - Contexto de asistencia que incluye información del empleado, jornadas, marcaciones, solicitudes y decisiones.
 * @returns - Resultado detallado de la asistencia del empleado en el período especificado.
 * 
 * Esta función procesa las marcaciones del empleado, evalúa cada día del período según las jornadas históricas,
 * solicitudes de asistencia y decisiones, y genera un resultado completo que incluye días trabajados, faltas,
 * minutos de tardanza, minutos extra, alertas y más.
 * 
 * La función es determinista y no depende del reloj, la base de datos ni Redis, garantizando resultados consistentes
 * para el mismo contexto de entrada.
 * 
 * @example
 * const resultado = calcularAsistencia(contextoAsistencia);
 */
export function calcularAsistencia(contexto: ContextoAsistencia): ResultadoAsistencia {
    //Validar el período y obtener el año y mes correspondientes
    const { year, month } = ServerTime.validarPeriodo(contexto.periodo);
    
    //Calcular la cantidad de días en el período
    const dias = new Date(Date.UTC(year, month, 0)).getUTCDate();
    
    //Combinar feriados nacionales y descansos del contexto en un mapa para fácil acceso
    const descansos = new Map([...feriadosNacionalesPeru(year), ...contexto.descansos].map((d) => [d.fecha, d.nombre]));
    
    //Organizar las marcaciones por día y hora para su evaluación
    const marcasPorDia = new Map<string, MarcaDia[]>();
    
    //Iterar sobre las marcaciones del contexto, ordenarlas por fecha y hora, y agruparlas por día
    for (const m of [...contexto.marcaciones].sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora))) {
        //Convertir la fecha y hora de la marcación a la zona horaria de Lima y formatearla para obtener la fecha y hora correspondientes
        const instante = new Date(m.fecha_hora), fecha = ServerTime.fechaPeru(instante);
        const hora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instante);
        const marcas = marcasPorDia.get(fecha) ?? [];

        //Agregar la marcación al arreglo de marcas del día correspondiente, incluyendo el tipo de marcación, hora y origen
        marcas.push({ id: m.id, tipo: m.tipo_marcacion, hora, origen: m.metodo });
        marcasPorDia.set(fecha, marcas);
    }
    
    // Evaluar cada día del período
    const detalle = Array.from({ length: dias }, (_, indice) => {
        //Construir la fecha del día actual en el formato YYYY-MM-DD
        const fecha = `${contexto.periodo}-${String(indice + 1).padStart(2, '0')}`;
        //Retornar el resultado de la evaluación del día utilizando la función evaluarFecha, pasando el contexto, la fecha, las marcas del día y los descansos
        return evaluarFecha(contexto, fecha, marcasPorDia.get(fecha) ?? [], descansos);
    });

    //Verificar si hay solicitudes de asistencia sin fechas de inicio o fin y agregar una alerta correspondiente
    if (contexto.solicitudes.some((s) => !s.fecha_inicio || !s.fecha_fin))
        (detalle.find((d) => d.estado !== 'FUERA_DE_VINCULO') ?? detalle[0])
            .alertas.push('SOLICITUD_DE_ASISTENCIA_SIN_FECHAS');
    
    //Filtrar las solicitudes de licencia médica aprobadas que se superponen con el período de evaluación
    const medicasDelMes = contexto.solicitudes.filter((s) =>
        s.tipo === 'LICENCIA_MEDICA' &&
        s.estado === 'APROBADA' &&
        s.fecha_inicio &&
        s.fecha_fin &&
        s.fecha_inicio.slice(0, 7) <= contexto.periodo &&
        s.fecha_fin.slice(0, 7) >= contexto.periodo
    );
    
    // Calcular la fecha de finalización del período
    const finDelPeriodo = `${contexto.periodo}-${String(dias).padStart(2, '0')}`;
    
    //Verificar si alguna de las solicitudes médicas del mes requiere revisión de subsidios y agregar una alerta correspondiente
    if (medicasDelMes.some((s) => s.efecto_asistencia === 'SUBSIDIO' || (s.efecto_asistencia === 'CON_GOCE' &&  diasMedicosAcumulados(contexto.solicitudes, s.fecha_fin.slice(0, 7) === contexto.periodo ? s.fecha_fin : finDelPeriodo) > 20))) {
        //Agregar alerta de incapacidad médica que requiere revisión de subsidios al primer día evaluado que no esté fuera de vínculo, o al primer día del detalle si todos están fuera de vínculo
        (detalle.find((d) => d.estado !== 'FUERA_DE_VINCULO') ?? detalle[0]).alertas.push('INCAPACIDAD_MEDICA_REQUIERE_REVISION_DE_SUBSIDIOS');
    }

    //Función auxiliar para sumar un campo específico de los resultados diarios
    const sumar = (campo: keyof ResultadoDia) => detalle.reduce((total, d) => total + Number(d[campo]), 0);
    
    //Calcular los días de vínculo del empleado en el período utilizando la función diasDeVinculo
    const base = contexto.empleado.fecha_inicio ? diasDeVinculo(contexto.empleado.fecha_inicio, contexto.empleado.fecha_cese, contexto.periodo) : 0;
    
    //Calcular las faltas y los días sin goce considerando el total de días de vínculo y los resultados diarios
    const faltas = Math.min(base, sumar('falta'));
    const diasSinGoce = Math.min( base - faltas, detalle.filter((d) => d.estado !== 'FUERA_DE_VINCULO').every((d) => d.sin_goce === 1) ? base : sumar('sin_goce') );
    
    //Retornar el resultado completo de la asistencia, incluyendo días trabajados, faltas, minutos de tardanza, minutos extra, alertas y más
    return {
        periodo: contexto.periodo,
        dias_vinculo: base,
        dias_trabajados: Math.max(0, base - faltas - diasSinGoce),
        faltas,
        dias_sin_goce: diasSinGoce,
        minutos_sin_goce: sumar('minutos_sin_goce'),
        minutos_tardanza: sumar('minutos_tardanza'),
        minutos_salida_anticipada: sumar('minutos_salida_anticipada'),
        minutos_extras_25: sumar('minutos_extra_25'),
        minutos_extras_35: sumar('minutos_extra_35'),
        pendientes: detalle.filter((d) => d.alertas.length > 0).length,
        completo: detalle.every((d) => d.estado !== 'NO_EVALUADO'),
        detalle,
        version_motor: VERSION_MOTOR_ASISTENCIA
    };
}
