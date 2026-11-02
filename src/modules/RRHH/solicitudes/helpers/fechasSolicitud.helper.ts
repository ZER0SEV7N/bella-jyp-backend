//src/modules/RRHH/solicitudes/helpers/fechasSolicitud.helper.ts
import { BadRequestException } from '@nestjs/common';
import type { solicitud } from '@prisma/client';
import { ServerTime } from '@/common/utils/server-time';

/**
 * Convierte una fecha de solicitud en formato string (YYYY-MM-DD) a un objeto Date.
 * @param valor - La fecha en formato string a convertir.
 * @returns - Un objeto Date correspondiente a la fecha proporcionada, o null si no se proporciona un valor.
 * @throws - Lanza una BadRequestException si el formato de la fecha es incorrecto o si la fecha no existe en el calendario.
 */
export function convertirFechaSolicitud(valor?: string | null): Date | null {
    if (!valor) return null;

    //Validación del formato de la fecha y conversión a objeto Date, lanzando excepciones si el formato es incorrecto o la fecha no existe.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor))
        throw new BadRequestException('Las fechas deben usar el formato YYYY-MM-DD.');

    //Convierte la fecha simple a un objeto Date utilizando la utilidad ServerTime.
    let fecha: Date;
    try {
        fecha = ServerTime.desdeFechaSimple(valor);
    } catch (error) {
        if (error instanceof RangeError) 
            throw new BadRequestException(`La fecha '${valor}' no existe en el calendario.`);
        
        throw error;
    }

    //Verifica que la fecha sea válida y que coincida con el valor proporcionado, lanzando una excepción si no es así.
    if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor)
        throw new BadRequestException(`La fecha '${valor}' no existe en el calendario.`);

    return fecha;
}

/**
 * Calcula la fecha límite de revisión de una solicitud basada en la fecha de inicio proporcionada.
 * @param fechaInicio - La fecha de inicio de la solicitud, que puede ser null.
 * @returns - Un objeto Date que representa la fecha límite de revisión, calculada como un día antes de la fecha de inicio si se proporciona, 
 * o tres días después de la fecha actual si no se proporciona.
 * @throws - No lanza excepciones, pero devuelve la fecha límite de revisión calculada.
 */
export function calcularFechaLimiteRevision(fechaInicio: Date | null): Date {
    const fecha = new Date(fechaInicio ?? ServerTime.obtenerFechaSimpleActual);
    fecha.setUTCDate(fecha.getUTCDate() + (fechaInicio ? -1 : 3));
    return fecha;
}

/**
 * Calcula la antigüedad de un empleado en función de su fecha de inicio y la fecha actual.
 * @param fechaInicio - La fecha de inicio del empleado, que puede ser null.
 * @param hoy - La fecha actual, que se utiliza para calcular la antigüedad. Por defecto, se obtiene la fecha actual del servidor.
 * @returns - Una cadena que representa la antigüedad del empleado en años y meses, o un mensaje indicando que la antigüedad no está registrada o que el ingreso está programado.
 * @throws - No lanza excepciones, pero devuelve un mensaje adecuado según la antigüedad calculada.
 */
export function calcularAntiguedad(fechaInicio: Date | null, hoy: Date = ServerTime.obtenerFechaSimpleActual): string {
    if (!fechaInicio) return 'No registrada';
    if (fechaInicio > hoy) return 'Ingreso programado';

    //Calcula la diferencia en años y meses entre la fecha de inicio y la fecha actual, ajustando los valores según sea necesario.
    let años = hoy.getUTCFullYear() - fechaInicio.getUTCFullYear();
    let meses = hoy.getUTCMonth() - fechaInicio.getUTCMonth();

    //Ajusta los meses si el día del mes actual es menor que el día del mes de la fecha de inicio.
    if (hoy.getUTCDate() < fechaInicio.getUTCDate()) 
        meses--;

    //Si los meses son negativos, ajusta los años y meses para reflejar la antigüedad correctamente.
    if (meses < 0) {
        años--;
        meses += 12;
    }

    //Devuelve la antigüedad en un formato legible, manejando casos especiales como menos de un mes o solo meses.
    if (años === 0 && meses === 0) return 'Menos de 1 mes';
    if (años === 0) 
        return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;

    return `${años} ${años === 1 ? 'año' : 'años'} ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}

/**
 * Calcula la alerta de urgencia para una solicitud basada en su estado y fechas relevantes.
 * @param solicitud  - Un objeto que contiene el estado, la fecha de inicio y la fecha límite de la solicitud.
 * @param hoy - La fecha actual, que se utiliza para determinar la urgencia de la solicitud. Por defecto, se obtiene la fecha actual del servidor.
 * @returns - Un objeto que contiene un mensaje y un detalle de la alerta de urgencia, o null si no hay alerta.
 * @throws - No lanza excepciones, pero devuelve null si la solicitud no requiere atención inmediata.
 */
export function obtenerAlertaUrgencia(solicitud: Pick<solicitud, 'estado' | 'fecha_inicio' | 'fecha_limite'>, hoy: Date = ServerTime.obtenerFechaSimpleActual) {
    if (solicitud.estado !== 'PENDIENTE' && solicitud.estado !== 'EN_REVISION') return null;

    const periodoIniciado = solicitud.fecha_inicio !== null && solicitud.fecha_inicio <= hoy;
    const limiteAlcanzado = solicitud.fecha_limite !== null && solicitud.fecha_limite <= hoy;

    if (!periodoIniciado && !limiteAlcanzado) return null;

    return {
        mensaje: periodoIniciado ? 'Atención inmediata: el período solicitado ya ha comenzado.' : 'Atención inmediata: se alcanzó la fecha límite de revisión.',
        detalle: 'La solicitud permanece sin resolver. Revise sus fechas y el responsable asignado.'
    };
}
