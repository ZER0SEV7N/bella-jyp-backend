//src/common/utils/server-time.ts
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

export const TIMEZONE_PERU = 'America/Lima'; //Zona horaria de Perú

/**
 * Clase ServerTime
 * Esta clase proporciona métodos estáticos para obtener la fecha y hora del servidor en la zona horaria de Perú, así como el período actual y anterior en formato "YYYY-MM".
 * Utiliza la librería dayjs para manejar fechas y horas, incluyendo soporte para zonas horarias.
 */
export class ServerTime {
    static get obtenerFechaServidor(): Date { return dayjs().tz(TIMEZONE_PERU).toDate(); }
    static get obtenerPeriodoActual(): string { return dayjs().tz(TIMEZONE_PERU).format('YYYY-MM'); }
    static get obtenerPeriodoAnterior(): string { return dayjs().tz(TIMEZONE_PERU).subtract(1, 'month').format('YYYY-MM'); }
    static get obtenerYearActual(): number { return dayjs().tz(TIMEZONE_PERU).year(); }

    /**
     * Obtiene la fecha actual en formato "YYYY-MM-DD" sin considerar la hora, ajustada a la zona horaria de Perú.
     * @return {Date} - La fecha actual en formato "YYYY-MM-DD" como un objeto Date.
     * @example const fechaActual = ServerTime.obtenerFechaSimpleActual;
     * @description Este método utiliza dayjs para obtener la fecha actual en la zona horaria de Perú y 
     * luego crea un objeto Date con el año, mes y día correspondientes, estableciendo la hora a 00:00:00 UTC.
     */
    static get obtenerFechaSimpleActual(): Date {
        const ahoraPeru = dayjs().tz(TIMEZONE_PERU);

        return new Date(Date.UTC(
            ahoraPeru.year(),
            ahoraPeru.month(),
            ahoraPeru.date()
        ));
    }

    /**
     * Convierte YYYY-MM-DD a Date sin introducir desplazamientos
     * por zona horaria.
     * @param fecha - string - Fecha en formato "YYYY-MM-DD".
     * @return {Date} - La fecha convertida a un objeto Date sin desplazamientos de zona horaria.
     * @example const fecha = ServerTime.desdeFechaSimple('2024-06-15');
     * @description Este método toma una cadena de fecha en formato "YYYY-MM-DD", la divide en año, mes y día, 
     * y luego crea un objeto Date utilizando Date.UTC para evitar cualquier desplazamiento de zona horaria.
     */
    static desdeFechaSimple(fecha: string): Date {
        const [year, month, day] = fecha.split('-').map(Number);

        return new Date(Date.UTC( year, month - 1, day ));
    }
}