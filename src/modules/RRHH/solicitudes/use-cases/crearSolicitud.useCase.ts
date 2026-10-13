//src/modules/rrhh/solicitudes/use-cases/crearSolicitud.useCase.ts
import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearSolicitudDto, TipoSolicitud } from '@jyp/shared-contracts';
import { ServerTime } from '@/common/utils/server-time';
import { Prisma } from '@prisma/client';

const MAX_INTENTOS_CORRELATIVO = 5; //Número máximo de intentos para generar un código correlativo único para la solicitud

/**
 * Funcion auxilias para generar el codigo secuencial correlativo para las solicitudes
 * estableciendo el formato "SOL-YYYY-NNN" donde YYYY es el año actual y NNN es un número secuencial de 3 dígitos.
 * @param prisma - Instancia del servicio Prisma para interactuar con la base de datos.
 * @returns Una promesa que resuelve con el código correlativo generado.
 */
async function generarCodigoCorrelativo(prisma: PrismaService): Promise<string> {
    const currentYear = new Date().getFullYear(); //Año actual
    const prefix = `SOL-${currentYear}-`; //Prefijo del código correlativo

    const ultimaSolicitud = await prisma.solicitud.findFirst({
        where: { codigo: { startsWith: prefix } },
        orderBy: { codigo: 'desc' },
        select: { codigo: true }
    });

    let siguienteSecuencia = 1; //Secuencia inicial

    //Si existe una solicitud previa, extraer la secuencia y aumentarla en 1
    if(ultimaSolicitud && ultimaSolicitud.codigo) {
        const partes = ultimaSolicitud.codigo.split('-');
        const secuenciaActual = Number.parseInt(partes[2], 10);
        if (!Number.isNaN(secuenciaActual)) siguienteSecuencia = secuenciaActual + 1;
    }

    return `${prefix}${siguienteSecuencia.toString().padStart(3, '0')}`; //Formatear con ceros a la izquierda
}

/**
 * Funcion para calcular la fecha límite de revisión de una solicitud.
 * Si la solicitud tiene una fecha de inicio, la fecha límite será un día antes de esa fecha.
 * Si no tiene fecha de inicio, la fecha límite será tres días después de la fecha actual del servidor.
 * @param fechaInicio - Fecha de inicio de la solicitud, puede ser null.
 * @returns La fecha límite de revisión como un objeto Date.
 * @example const fechaLimite = calcularFechaLimiteRevision(new Date('2024-06-15'));
 */
function calcularFechaLimiteRevision(fechaInicio: Date | null): Date {

    //Si hay fecha de inicio, la fecha límite es 1 día antes
    if (fechaInicio) {
        const fechaLimite = new Date(fechaInicio);

        fechaLimite.setUTCDate(fechaLimite.getUTCDate() - 1);

        return fechaLimite;
    }

    //Si no hay fecha de inicio, la fecha límite es 3 días desde hoy
    const fechaLimite = new Date( ServerTime.obtenerFechaSimpleActual );
    fechaLimite.setUTCDate( fechaLimite.getUTCDate() + 3);
    return fechaLimite;
}


/**
 * Funcion para validar reglas de negocio específicas según el tipo de solicitud.
 * Actualmente valida que las solicitudes de tipo "ADELANTO_SUELDO" tengan un monto mayor a cero.
 * @param dto - Objeto de transferencia de datos que contiene la información de la solicitud a validar.
 * @throws BadRequestException si las reglas de negocio no se cumplen.
 */
function validarReglasPorTipo(dto: CrearSolicitudDto): void {

    if (dto.tipo === 'ADELANTO_SUELDO') 
        if ( dto.monto === undefined || dto.monto === null || dto.monto <= 0) throw new BadRequestException({
            title: 'Monto requerido',
            detail:'Para solicitudes de ADELANTO_SUELDO debe especificar un monto válido mayor a cero.'
        });
}

/**
 * Caso de uso para crear una nueva solicitud.
 * Este caso de uso tiene como objetivo validar los datos de entrada, 
 * generar un código correlativo único para la solicitud,
 * y persistir la nueva solicitud en la base de datos.
 */

@Injectable()
export class CrearSolicitudUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para crear una nueva solicitud.
     * @param dto - Objeto de transferencia de datos que contiene la información de la nueva solicitud a crear.
     * @param empleadoId - ID del empleado que está creando la solicitud.
     * @param archivo - Información opcional del archivo adjunto a la solicitud.
     * @returns Una promesa que resuelve con la nueva solicitud creada.
     * @throws BadRequestException si los datos de entrada son inválidos.
     * @throws NotFoundException si el empleado no existe en el sistema.
     */
    async execute(dto: CrearSolicitudDto, empleadoId: string, archivo?: {url: string; nombreOriginal: string}) {
        const empleadoIdFinal = dto.empleado_id ?? empleadoId; //Si no se proporciona empleado_id, usar el del token
        if(!empleadoIdFinal) throw new BadRequestException('El identificador del empleado solicitante es obligatorio.');

        //Validar que el empleado exista
        const empleado = await this.prisma.empleados.findUnique({
            where: {id: empleadoIdFinal, deleted_at: null}, 
            select: {id: true, activo: true }
        });
        if(!empleado  || !empleado.activo) throw new NotFoundException('El empleado especificado no existe en el sistema.');

        //Validar reglas de negocio según el tipo de solicitud
        validarReglasPorTipo(dto);

        //Regla de Negocio: Validación estricta del monto de adelanto
        const fechaInicio = dto.fecha_inicio ? ServerTime.desdeFechaSimple(dto.fecha_inicio) : null;
        const fechaFin = dto.fecha_fin ? ServerTime.desdeFechaSimple(dto.fecha_fin) : null;

        if (fechaInicio && fechaFin && fechaInicio > fechaFin) throw new BadRequestException({
            title: 'Rango de fechas inválido',
            detail: 'La fecha de inicio no puede ser posterior a la fecha de fin.'
        });
        
        //Calcular la fecha límite de revisión de la solicitud
        const fechaLimiteRevision = calcularFechaLimiteRevision(fechaInicio);

        /*
         * El UNIQUE de codigo en PostgreSQL sigue siendo
         * la última defensa contra condiciones de carrera.
         * Si dos solicitudes obtienen el mismo correlativo,
         * una fallará con P2002 y se vuelve a calcular.
         */
        for (let intento = 1; intento <= MAX_INTENTOS_CORRELATIVO; intento++) {
            const codigoCorrelativo = await generarCodigoCorrelativo(this.prisma);

            try {
                return await this.prisma.solicitud.create({
                    data: {
                        id: IdentityGenerator.generateId(),
                        empleado_id: empleadoIdFinal,
                        codigo: codigoCorrelativo,
                        tipo: dto.tipo as TipoSolicitud,
                        estado: 'PENDIENTE',
                        monto: dto.tipo === 'ADELANTO_SUELDO' ? dto.monto : null,
                        fecha_inicio: fechaInicio,
                        fecha_fin: fechaFin,
                        dias_solicitados: dto.dias_solicitados ?? 1,
                        motivo: dto.motivo.trim(),
                        observacion: dto.observacion?.trim() ?? null,
                        sustento_url: archivo?.url ?? null,
                        sustento_nombre: archivo?.nombreOriginal ?? null,
                        fecha_limite: fechaLimiteRevision,
                        origen: dto.origen ?? 'PORTAL_EMPLEADO'
                    },

                    include: {
                        empleados: {
                            select: {
                                id: true,
                                nombre: true,
                                apellido: true,
                                nro_documento: true,
                                //Incluir información del área y cargo del empleado
                                area: { select: { id: true, nombre: true} },
                                cargo: { select: { id: true, nombre: true } }
                            }
                        }
                    }
                });
            } catch (error) {

                //Si ocurre un error de colisión de código correlativo, intentar nuevamente hasta el máximo de intentos
                const esColisionCorrelativo = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

                if ( esColisionCorrelativo && intento < MAX_INTENTOS_CORRELATIVO) 
                    continue;
                
                //Si se alcanza el máximo de intentos y aún hay colisión, lanzar excepción de conflicto
                if (esColisionCorrelativo) throw new ConflictException({
                    title: 'Conflicto de correlativo',
                    detail: 'No fue posible generar un código único para la solicitud. Intente nuevamente.'
                });
                
                throw error;
            }
        }

        throw new ConflictException('No fue posible registrar la solicitud.');
    }
}