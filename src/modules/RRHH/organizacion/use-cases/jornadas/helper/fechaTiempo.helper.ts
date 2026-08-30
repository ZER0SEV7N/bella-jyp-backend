//src/modules/RRHH/organizacion/use-cases/jornadas/helper/fechaTiempo.helper.ts
/**
 * Funcion que convierte un string de tiempo en un objeto Date.
 * @param time - String de tiempo en formato "HH:mm:ss" o "HH:mm" o un objeto Date.
 * @returns Un objeto Date con la fecha establecida en 1970-01-01 y la hora establecida según el string de tiempo.
 * @throws Error si el string de tiempo no tiene un formato válido.
 */

export function normalizarTimeToDate(time: string | Date): Date {
    //Si el tiempo ya es un objeto Date, simplemente lo devolvemos
    if (time instanceof Date) return time;
    
    //Si el tiempo es un string, lo procesamos
    const trimmed = time.trim();
    if (trimmed.includes('T')) return new Date(trimmed);

    //Dividimos el string en horas, minutos y segundos
    const [hours, minutes, seconds = '00'] = trimmed.split(':');
    return new Date(Date.UTC(1970, 0, 1, Number(hours), Number(minutes), Number(seconds)));
}