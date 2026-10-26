//src/modules/asistencia/domain/intervalos-asistencia.ts
import type { HorarioDia, MarcaDia } from './asistencia.types';

/**
 * Regla de negocio que encapsula la lógica de cálculo de intervalos de tiempo, incluyendo duración, resta de intervalos y conversión de horas a minutos.
 * Se utiliza para evaluar la asistencia de los trabajadores, considerando horarios programados, marcas de entrada/salida y ausencias.
 * Se proporciona una función para calcular la tardanza en el retorno del refrigerio, considerando los intervalos programados, trabajados y faltantes.
 */
export type Intervalo = [number, number]; //Intervalo de tiempo representado por un par de números que indican el inicio y el fin en minutos desde la medianoche.
export const minutos = (hora: string) => {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
};
export const duracion = (intervalos: Intervalo[]) => intervalos.reduce((total, [inicio, fin]) => total + fin - inicio, 0); //Calcula la duración total de un conjunto de intervalos 
//sumando las diferencias entre el inicio y el fin de cada intervalo.

/**
 * Calcula la diferencia entre un conjunto de intervalos base y un conjunto de intervalos de cobertura, devolviendo los intervalos restantes que no están cubiertos.
 * @param base - Arreglo de intervalos que representan los periodos de tiempo base a evaluar.
 * @param coberturas - Arreglo de intervalos que representan los periodos de tiempo que se deben restar de los intervalos base.
 * @returns - Arreglo de intervalos que representan los periodos de tiempo restantes después de restar las coberturas de los intervalos base.
 * @throws Error si los intervalos de base o coberturas no son válidos.
 */
export function restar(base: Intervalo[], coberturas: Intervalo[]): Intervalo[] {
    //Valida que los intervalos de base y coberturas sean válidos, es decir, que cada intervalo tenga un inicio menor que el fin.
    return coberturas.reduce(
        (restantes, [desde, hasta]) =>
            //Para cada intervalo de cobertura, se calcula la diferencia con los intervalos restantes actuales, generando nuevos intervalos que representan los periodos no cubiertos.
            restantes.flatMap(([inicio, fin]) => {
                //Si el intervalo de cobertura no se superpone con el intervalo restante, se devuelve el intervalo restante tal cual.
                if (hasta <= inicio || desde >= fin) 
                    return [[inicio, fin] as Intervalo];

                //Si hay superposición, se calcula los intervalos restantes antes y después del intervalo de cobertura, si existen.
                const partes: Intervalo[] = [];
                if (desde > inicio) 
                    partes.push([inicio, desde]);
                if (hasta < fin) 
                    partes.push([hasta, fin]);
                //Se devuelven los intervalos restantes después de restar el intervalo de cobertura.
                return partes;
            }),
        base
    );
}

/**
 * Calcula los intervalos de tiempo programados para un día específico según el horario laboral proporcionado.
 * @param horario - Objeto que representa el horario laboral del día, incluyendo la hora de entrada, salida y los periodos de descanso.
 * @returns - Arreglo de intervalos que representan los periodos de tiempo programados para el día, o null si el horario no es válido.
 * @throws Error si el horario proporcionado no es válido o no cumple con los requisitos de formato.
 */
export function horarioProgramado(horario: HorarioDia): Intervalo[] | null {
    //Valida que el horario tenga horas de entrada y salida definidas; si no, devuelve null indicando que no hay un horario programado válido.
    if (!horario.entrada || !horario.salida) 
        return null;

    //Calcula los minutos de inicio y fin del horario laboral a partir de las horas de entrada y salida proporcionadas.
    const inicio = minutos(horario.entrada), fin = minutos(horario.salida);
    //El alcance actual admite jornadas diurnas fijas; los turnos nocturnos requieren otro motor.
    if (fin <= inicio) 
        return null;

    //Si no hay periodos de descanso definidos, se devuelve un único intervalo que representa todo el horario laboral.
    if (!horario.inicio_descanso && !horario.fin_descanso) 
        return [[inicio, fin]];

    //Si hay periodos de descanso definidos, se valida que estén dentro del horario laboral y se devuelve un arreglo de intervalos que representan los periodos trabajados antes y después del descanso.
    if (!horario.inicio_descanso || !horario.fin_descanso) 
        return null;

    //Calcula los minutos de inicio y fin del periodo de descanso a partir de las horas de inicio y fin de descanso proporcionadas.
    const descanso = minutos(horario.inicio_descanso), retorno = minutos(horario.fin_descanso);
    if (descanso <= inicio || retorno <= descanso || retorno >= fin) 
        return null;
    
    //Devuelve un arreglo de intervalos que representan los periodos trabajados antes y después del descanso, excluyendo el periodo de descanso en sí.
    return [
        [inicio, descanso],
        [retorno, fin]
    ];
}

/**
 * Calcula los intervalos de tiempo efectivamente trabajados por un empleado durante un día específico, a partir de las marcas registradas y el horario laboral.
 * @param marcas - Arreglo de marcas de asistencia registradas para el día, que incluyen las horas de entrada y salida.
 * @param horario - Objeto que representa el horario laboral del día, incluyendo la hora de entrada, salida y los periodos de descanso.
 * @returns - Arreglo de intervalos que representan los periodos de tiempo efectivamente trabajados por el empleado durante el día, o null si las marcas no son válidas.
 * @throws Error si las marcas o el horario proporcionados no son válidos o no cumplen con los requisitos de formato.
 */
export function intervalosTrabajados(marcas: MarcaDia[], horario: HorarioDia): Intervalo[] | null {
    //Verifica que las marcas estén en un orden válido y que no haya duplicados.
    const tipos = marcas.map((m) => m.tipo).join(',');
    if (!['ENTRADA,SALIDA', 'ENTRADA,SALIDA_ALMUERZO,ENTRADA_ALMUERZO,SALIDA'].includes(tipos)) 
        return null;

    //Convierte las horas de las marcas a minutos desde la medianoche y verifica que estén en orden ascendente.
    const horas = marcas.map((m) => minutos(m.hora));
    if (horas.some((hora, indice) => indice > 0 && hora <= horas[indice - 1])) 
        return null;
    
    //Si hay 4 marcas, se asume que son entrada, salida, entrada almuércio y salida del almuerzo.
    if (horas.length === 4)
        return [
            [horas[0], horas[1]],
            [horas[2], horas[3]]
        ];
    //Sin marcas de refrigerio se descuenta el descanso programado, sin inventar marcas físicas.
    const descanso: Intervalo[] = horario.inicio_descanso && horario.fin_descanso ? [[minutos(horario.inicio_descanso), minutos(horario.fin_descanso)]] : [];
    return restar([[horas[0], horas[1]]], descanso);
}
