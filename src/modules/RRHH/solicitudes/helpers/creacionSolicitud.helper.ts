//src/modules/RRHH/solicitudes/helpers/creacionSolicitud.helper.ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma, TipoSolicitud } from '@prisma/client';
import type { rol_usuario_enum } from '@prisma/client';
import type { CrearSolicitudDto } from '@jyp/shared-contracts';
import type { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { convertirFechaSolicitud } from './fechasSolicitud.helper';

//Constante que define la cantidad máxima de intentos para generar un código correlativo único antes de fallar.
export const MAX_INTENTOS_CORRELATIVO = 5;

/**
 * Funcion que resuelve el empleado solicitante de una solicitud de RRHH según el rol del usuario y los datos proporcionados en el DTO.
 * @param dto - Objeto que contiene los datos de la solicitud a crear.
 * @param empleadoIdSesion - Identificador del empleado que está realizando la solicitud (puede ser null si el rol es ADMIN o RRHH).
 * @param rol - Rol del usuario que está realizando la solicitud (ADMIN, RRHH o EMPLEADO).
 * @returns - Identificador del empleado solicitante resuelto.
 * @throws forbiddenException - Si el rol del usuario no tiene permisos para registrar solicitudes de RRHH o si un empleado intenta registrar una solicitud para otro empleado.
 * @throws badRequestException - Si no se puede determinar el identificador del empleado solicitante.
 */
export function resolverEmpleadoSolicitante(dto: CrearSolicitudDto, empleadoIdSesion: string | null, rol: rol_usuario_enum): string {
    //Validaciones de permisos según el rol del usuario que realiza la solicitud.
    if (!['ADMIN', 'RRHH', 'EMPLEADO'].includes(rol))
        throw new ForbiddenException('Su rol no puede registrar solicitudes de RRHH.');

    //Validación específica para el rol de EMPLEADO: no puede registrar solicitudes para otros empleados.
    if (rol === 'EMPLEADO' && dto.empleado_id && dto.empleado_id !== empleadoIdSesion)
        throw new ForbiddenException('Solo puede registrar solicitudes para su propio legajo.');

    //Validación específica para el rol de EMPLEADO: no puede modificar el origen de la solicitud ni agregar observaciones de revisión.
    if (rol === 'EMPLEADO' && (dto.origen && dto.origen !== 'PORTAL_EMPLEADO' || dto.observacion?.trim()))
        throw new ForbiddenException('El colaborador no puede registrar observaciones de revisión ni modificar el origen de la solicitud.');

    //Resolución del identificador del empleado solicitante según el rol y los datos proporcionados en el DTO.
    const empleadoId = rol === 'EMPLEADO' ? empleadoIdSesion : dto.empleado_id ?? empleadoIdSesion;

    if (!empleadoId) throw new BadRequestException('El identificador del empleado solicitante es obligatorio.');

    return empleadoId;
}

/**
 * Valida los datos de la solicitud según el tipo de solicitud y las reglas de negocio definidas.
 * @param dto - Objeto que contiene los datos de la solicitud a crear.
 * @returns - Un objeto con el tipo de solicitud y las fechas de inicio y fin validadas.
 * @throws badRequestException - Si los datos de la solicitud no cumplen con las reglas de negocio.
 */
export function validarDatosSolicitud(dto: CrearSolicitudDto) {
    //Validación de que el tipo de solicitud proporcionado en el DTO esté habilitado en el modelo de datos.
    if (!Object.prototype.hasOwnProperty.call(TipoSolicitud, dto.tipo))
        throw new BadRequestException('Este tipo de solicitud aún no está habilitado en el modelo de datos.');

    //Resolución del tipo de solicitud y conversión de las fechas de inicio y fin a objetos Date.
    const tipo = TipoSolicitud[dto.tipo as keyof typeof TipoSolicitud]; //Convierte el tipo de solicitud a su valor correspondiente en el enum TipoSolicitud.
    const fechaInicio = convertirFechaSolicitud(dto.fecha_inicio); //Convierte la fecha de inicio a un objeto Date.
    const fechaFin = convertirFechaSolicitud(dto.fecha_fin); //Convierte la fecha de fin a un objeto Date.

    //Validación de que las fechas de inicio y fin estén presentes para los tipos de solicitud que las requieren.
    if (['VACACIONES', 'LICENCIA_MEDICA', 'PERMISO'].includes(tipo) && (!fechaInicio || !fechaFin))
        throw new BadRequestException('Este tipo de solicitud requiere fecha de inicio y fecha de fin.');

    //Validación de que la fecha de inicio no sea posterior a la fecha de fin.
    if (fechaInicio && fechaFin && fechaInicio > fechaFin)
        throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.');

    //Validación de que el monto sea un número válido mayor a cero para el tipo de solicitud ADELANTO_SUELDO.
    if (tipo === 'ADELANTO_SUELDO' && (typeof dto.monto !== 'number' || !Number.isFinite(dto.monto) || dto.monto <= 0))
        throw new BadRequestException('El adelanto de sueldo requiere un monto válido mayor a cero.');

    //Validación de que el monto no exceda los límites definidos para el tipo de solicitud ADELANTO_SUELDO.
    if (tipo === 'ADELANTO_SUELDO' && (new Prisma.Decimal(String(dto.monto)).gt('99999999.9999') || new Prisma.Decimal(String(dto.monto)).decimalPlaces() > 4))
        throw new BadRequestException('El monto debe caber en NUMERIC(12,4), con un máximo de cuatro decimales.');

    //Validación de que la cantidad de días solicitados sea un entero mayor a cero si se proporciona.
    if (dto.dias_solicitados != null && (!Number.isInteger(dto.dias_solicitados) || dto.dias_solicitados < 1))
        throw new BadRequestException('La cantidad de días debe ser un entero mayor a cero.');

    //Validación de que la cantidad de días solicitados no exceda los límites definidos para el tipo de solicitud VACACIONES.
    if (tipo === 'VACACIONES' && dto.dias_solicitados != null && dto.dias_solicitados > 365)
        throw new BadRequestException('La cantidad de días solicitados no puede exceder los 365 días para solicitudes de vacaciones.');

    return { tipo, fechaInicio, fechaFin };
}

/**
 * Funcion que genera un código correlativo único para una nueva solicitud de RRHH, basado en el año actual y la secuencia de solicitudes existentes.
 * @param prisma - Instancia del servicio Prisma para interactuar con la base de datos.
 * @returns - Una promesa que resuelve con el código correlativo generado.
 * @throws badRequestException - Si se agota la longitud admitida para el correlativo de solicitudes.
 */
export async function generarCodigoCorrelativo(prisma: PrismaService): Promise<string> {
    //Obtiene el año actual utilizando la clase ServerTime y define un patrón de búsqueda para los códigos existentes.
    const año = ServerTime.obtenerYearActual;
    const patron = `^SOL-${año}-[0-9]+$`;

    //MAX numérico evita que SOL-YYYY-999 sea considerado mayor que SOL-YYYY-1000.
    const [resultado] = await prisma.$queryRaw<{ ultima_secuencia: bigint | null }[]>`
        SELECT MAX(split_part(codigo, '-', 3)::bigint) AS ultima_secuencia
        FROM solicitud
        WHERE codigo ~ ${patron}
    `;

    //Genera la secuencia incrementando la última secuencia encontrada y formatea el código correlativo.
    const secuencia = ((resultado?.ultima_secuencia ?? 0n) + 1n).toString().padStart(3, '0');
    const codigo = `SOL-${año}-${secuencia}`;

    //Valida que la longitud del código generado no exceda los 20 caracteres permitidos.
    if (codigo.length > 20) throw new BadRequestException('Se agotó la longitud admitida para el correlativo de solicitudes.');

    //Devuelve el código correlativo generado.
    return codigo;
}

/**
 * Funcion que determina si hay una colisión de código al intentar crear una nueva solicitud de RRHH, basándose en el error devuelto por Prisma.
 * @param error 
 * @returns 
 */
export function esColisionDeCodigo(error: unknown): boolean {
    //Verifica si el error es una instancia de PrismaClientKnownRequestError y si el código de error es 'P2002' (violación de restricción única).
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;

    //Extrae el objetivo del error (el campo que causó la violación de restricción única) y verifica si es 'codigo'.
    const target = error.meta?.target;
    return Array.isArray(target) ? target.includes('codigo') : typeof target === 'string' && /codigo/i.test(target);
}
