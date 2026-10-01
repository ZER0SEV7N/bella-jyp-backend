import dayjs from "dayjs";

export class ServerTime {
    
    static get obtenerFechaServidor(): Date {
        return new Date();
    }

    static get obtenerPeriodoActual(): string {
        return dayjs().format('YYYY-MM')
    }

    static get obtnerPeridoAnterior(): string {
        return dayjs().subtract(1, 'month').format('YYYY-MM');
    }

    static get obtnerAnioActual(): number{
        return dayjs().year();
    }

}