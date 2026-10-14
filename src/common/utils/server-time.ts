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
    static get obtenerFechaServidor(): Date { return new Date(); }
    static get obtenerPeriodoActual(): string { return dayjs().tz(TIMEZONE_PERU).format('YYYY-MM'); }
    static get obtenerPeriodoAnterior(): string { return dayjs().tz(TIMEZONE_PERU).subtract(1, 'month').format('YYYY-MM'); }
    static get obtenerYearActual(): number { return dayjs().tz(TIMEZONE_PERU).year(); }
    static get obtenerMesActual(): number { return dayjs().tz(TIMEZONE_PERU).month() + 1; }
    static get obtenerFechaSimpleActual(): Date { return this.desdeFechaSimple(dayjs().tz(TIMEZONE_PERU).format('YYYY-MM-DD')); }
    static get obtenerRangoMesActual() { return this.obtenerRangoMes(this.obtenerPeriodoActual); }

    /** @deprecated Usar obtenerRangoMesActual. Se conserva por compatibilidad. */
    static get obtenerRangoMesAcutal() { return this.obtenerRangoMesActual; }


    /**
     * Convierte una fecha en formato "YYYY-MM-DD" a un objeto Date representando la medianoche UTC de esa fecha.
     * @param fecha  - La fecha en formato "YYYY-MM-DD".
     * @returns - Un objeto Date representando la medianoche UTC de la fecha proporcionada.
     * @throws - RangeError si la fecha no tiene el formato correcto o no existe en el calendario.
     * @example
     */
    static desdeFechaSimple(fecha: string): Date {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha))
            throw new RangeError('La fecha debe tener el formato YYYY-MM-DD.');

        const [year, month, day] = fecha.split('-').map(Number);
        const resultado = new Date(0);
        resultado.setUTCFullYear(year, month - 1, day);
        resultado.setUTCHours(0, 0, 0, 0);

        if (year < 1000 || resultado.getUTCFullYear() !== year || resultado.getUTCMonth() !== month - 1 || resultado.getUTCDate() !== day)
            throw new RangeError('La fecha no existe en el calendario.');

        return resultado;
    }

    /**
     * Valida un período en formato "YYYY-MM" y devuelve el año y mes como números.
     * @param periodo - El período en formato "YYYY-MM".
     * @returns - Un objeto con las propiedades year y month.
     */
    static validarPeriodo(periodo: string): { year: number; month: number } {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo))
            throw new RangeError('El período debe tener el formato YYYY-MM.');

        const [year, month] = periodo.split('-').map(Number);
        if (year < 1000) throw new RangeError('El año debe encontrarse entre 1000 y 9999.');

        return { year, month };
    }

    /**
     * Obtiene el rango de fechas para un período dado en formato "YYYY-MM".
     * @param periodo - El período en formato "YYYY-MM".
     * @returns - Un objeto con las propiedades inicioMes, finMes e inicioSiguienteMes.
     */
    static obtenerRangoMes(periodo: string): { inicioMes: Date; finMes: Date; inicioSiguienteMes: Date } {
        const { year, month } = this.validarPeriodo(periodo);
        if (year === 9999 && month === 12) throw new RangeError('El período excede el rango admitido.');

        const siguienteYear = month === 12 ? year + 1 : year;
        const siguienteMonth = month === 12 ? 1 : month + 1;
        const siguientePeriodo = `${String(siguienteYear).padStart(4, '0')}-${String(siguienteMonth).padStart(2, '0')}`;
        const inicioMes = dayjs.tz(`${periodo}-01 00:00:00`, TIMEZONE_PERU).toDate();
        const inicioSiguienteMes = dayjs.tz(`${siguientePeriodo}-01 00:00:00`, TIMEZONE_PERU).toDate();

        return { inicioMes, inicioSiguienteMes, finMes: new Date(inicioSiguienteMes.getTime() - 1) };
    }
}