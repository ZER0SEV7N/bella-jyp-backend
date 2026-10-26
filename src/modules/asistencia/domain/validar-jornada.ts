//src/modules/asistencia/domain/validar-jornada.ts
import type { HorarioDia } from './asistencia.types';

/**
 * Calculo de dominio para validar que un horario semanal cumpla con los criterios de una jornada regular, considerando la duración de los días laborables y el total de minutos declarados.
 * Se asegura de que el horario tenga siete días, que los días laborables tengan una duración uniforme entre 4 y 8 horas efectivas, y que el total de minutos coincida con lo declarado.
 */

//Constante que representa los días de la semana en español, utilizada para mapear los días de la semana a sus nombres correspondientes.
const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

/**
 * Convierte una hora en formato 'HH:mm' a minutos desde la medianoche, validando que la hora sea válida y esté dentro del rango permitido.
 * @param hora - Cadena que representa la hora en formato 'HH:mm'.
 * @returns - Número de minutos desde la medianoche.
 * @throws RangeError si la hora no es válida o no cumple con el formato esperado.
 */
function minuto(hora: string | null | undefined): number {
  //Valida que la hora no sea nula o indefinida y que cumpla con el formato 'HH:mm' antes de convertirla a minutos.
  if (!hora || !/^(?:[01]\d|2\d):[0-5]\d$/.test(hora)) {
    throw new RangeError('El horario debe contener horas válidas en formato HH:mm.');
  }

  //Convierte la hora a minutos desde la medianoche.
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
}

/**
 * Funcion que calcula los minutos efectivos de trabajo en un día laboral, considerando la hora de entrada, salida y el periodo de descanso.
 * Valida que el horario esté dentro del rango permitido (06:00 a 22:00) y que el periodo de descanso sea de al menos 45 minutos.
 * @param dia - Objeto que representa el horario laboral del día, incluyendo la hora de entrada, salida y los periodos de descanso.
 * @returns - Número de minutos efectivos de trabajo en el día.
 */
export function minutosEfectivos(dia: HorarioDia): number {
  //Valida que el horario tenga horas de entrada y salida definidas; si no, lanza un error indicando que el horario es inválido.
  const entrada = minuto(dia.entrada);

  //Valida que la hora de salida sea mayor que la hora de entrada y que ambas estén dentro del rango permitido (06:00 a 22:00), lanzando un error si no se cumple.
  const salida = minuto(dia.salida);

  //Valida que el periodo de descanso esté dentro del horario laboral y que tenga una duración mínima de 45 minutos, lanzando un error si no se cumple.
  if (salida <= entrada || entrada < 360 || salida > 1320) 
    throw new RangeError('El motor mensual admite horarios entre las 06:00 y las 22:00, sin cruce de medianoche.');
  
  //Valida que el periodo de descanso esté dentro del horario laboral y que tenga una duración mínima de 45 minutos, lanzando un error si no se cumple.
  const inicio = minuto(dia.inicio_descanso);
  const fin = minuto(dia.fin_descanso);

  //Si no se cumple con las condiciones de horario y duración del descanso, se lanza un error indicando que se debe configurar un refrigerio de al menos 45 minutos dentro del horario laboral.
  if (inicio <= entrada || fin >= salida || fin - inicio < 45) 
    throw new RangeError('Configure un refrigerio de al menos 45 minutos dentro del horario.');
  
  //Calcula y devuelve los minutos efectivos de trabajo en el día, restando el periodo de descanso del total de minutos entre la hora de entrada y salida.
  return salida - entrada - (fin - inicio);
}

/**
 * Funcion que valida que un horario semanal cumpla con los criterios de una jornada regular, considerando la duración de los días laborables y el total de minutos declarados.
 * Se asegura de que el horario tenga siete días, que los días laborables tengan una duración uniforme entre 4 y 8 horas efectivas, y que el total de minutos coincida con lo declarado.
 * @param horario - Arreglo de objetos que representan el horario laboral de cada día de la semana.
 * @param minutosDeclarados - Número total de minutos declarados para la jornada semanal.
 * @returns - Número total de minutos efectivos de trabajo en la jornada semanal.
 * @throws RangeError si el horario no cumple con los criterios de una jornada regular o si los minutos declarados no coinciden con el total calculado.
 */
export function validarJornadaRegular(horario: HorarioDia[], minutosDeclarados: number): number {
  //Valida que el horario tenga siete días, que los días laborables tengan una duración uniforme entre 4 y 8 horas efectivas, y que el total de minutos coincida con lo declarado.
  const nombres = new Set(horario.map((dia) => dia.dia));
  
  //Si el horario no tiene siete días, 
  //si los nombres de los días no son únicos o si no se incluyen todos los días de la semana, 
  //se lanza un error indicando que se debe configurar una sola vez cada uno de los siete días de la semana.
  if (horario.length !== 7 || nombres.size !== 7 || DIAS.some((dia) => !nombres.has(dia))) 
    throw new RangeError('Configure una sola vez cada uno de los siete días de la semana.');
  
  //Calcula las duraciones de los días laborables y valida que cumplan con los criterios de una jornada regular, lanzando un error si no se cumple.
  const duraciones = horario.filter((dia) => dia.laborable).map(minutosEfectivos);
  
  //Si la cantidad de días laborables es menor a cinco o mayor a seis, se lanza un error indicando que la jornada regular debe tener cinco o seis días laborables.
  if (duraciones.length < 5 || duraciones.length > 6) 
    throw new RangeError('La jornada regular debe tener cinco o seis días laborables.');
  
  //Si alguna de las duraciones de los días laborables está fuera del rango de 4 a 8 horas efectivas, o si no todas las duraciones son iguales, 
  //se lanza un error indicando que el motor mensual admite días de igual duración, entre cuatro y ocho horas efectivas.
  if (duraciones.some((duracion) => duracion < 240 || duracion > 480) || new Set(duraciones).size !== 1) 
    throw new RangeError('El motor mensual admite días de igual duración, entre cuatro y ocho horas efectivas.');
  
  //Calcula el total de minutos efectivos de trabajo en la jornada semanal y valida que coincida con los minutos declarados, lanzando un error si no se cumple.
  const total = duraciones.reduce((suma, duracion) => suma + duracion, 0);
  if (total > 2880 || total !== minutosDeclarados) 
    throw new RangeError('El horario debe coincidir con el total declarado y no superar 48 horas semanales.');
  
  return total;
}
