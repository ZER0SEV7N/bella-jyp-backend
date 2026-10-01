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
    //Metodos estaticos para obtener la fecha y hora del servidor en la zona horaria de Perú, así como el período actual y anterior en formato "YYYY-MM".
    static get obtenerFechaServidor(): Date { return dayjs().tz(TIMEZONE_PERU).toDate(); }
    static get obtenerPeriodoActual(): string { return dayjs().tz(TIMEZONE_PERU).format('YYYY-MM'); }
    static get obtenerPeriodoAnterior(): string {return dayjs().tz(TIMEZONE_PERU).subtract(1, 'month').format('YYYY-MM');}
    static get obtenerYearActual(): number { return dayjs().tz(TIMEZONE_PERU).year(); }
}