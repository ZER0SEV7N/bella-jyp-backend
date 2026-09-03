//src/modules/rrhh/solicitudes/use-cases/crearSolicitud.useCase.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearSolicitudDto } from '@jyp/shared-contracts';

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

    let siguienteSequencia = 1; //Secuencia inicial

    if(ultimaSolicitud && ultimaSolicitud.codigo) {
        const partes = ultimaSolicitud.codigo.split('-');
        const secuenciaActual = parseInt(partes[2], 10);
        if(!isNaN(secuenciaActual)) 
            siguienteSequencia = secuenciaActual + 1; //Incrementar la secuencia
    }

    return `${prefix}${siguienteSequencia.toString().padStart(3, '0')}`; //Formatear con ceros a la izquierda
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
        const empleado = await this.prisma.empleados.findUnique({where: {id: empleadoIdFinal, deleted_at: null}});
        if(!empleado  || !empleado.activo) throw new NotFoundException('El empleado especificado no existe en el sistema.');

        //Normalizar fechas
        const fechaInicio = dto.fecha_inicio ? new Date(dto.fecha_inicio) : null;
        const fechaFin = dto.fecha_fin ? new Date(dto.fecha_fin) : null;
        if(fechaInicio && fechaFin && fechaInicio > fechaFin) throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.');

        //Calcular la fecha limite de revision
        const fechaLimiteRevision = new Date();
        if(fechaInicio) fechaLimiteRevision.setTime(fechaInicio.getTime() - 24 * 60 * 60 * 1000); //1 día antes del período
        else fechaLimiteRevision.setDate(fechaLimiteRevision.getDate() + 3); //3 días a partir de hoy si no hay fecha de inicio

        //Generar el código correlativo
        const codigoCorrelativo = await generarCodigoCorrelativo(this.prisma);

        //Crear la solicitud en la base de datos
        return await this.prisma.solicitud.create({
            data: {
                id: IdentityGenerator.generateId(),
                empleado_id: empleadoIdFinal,
                codigo: codigoCorrelativo,
                tipo: dto.tipo,
                estado: 'PENDIENTE',
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                dias_solicitados: dto.dias_solicitados || 1,
                motivo: dto.motivo.trim(),
                observacion: dto.observacion?.trim() || null,
                sustento_url: archivo?.url || null,
                sustento_nombre: archivo?.nombreOriginal || null,
                fecha_limite: fechaLimiteRevision,
                origen: dto.origen || 'PORTAL_EMPLEADO'
            },
            include: {
                empleados: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        nro_documento: true,
                        area: { select: { id: true, nombre: true } },
                        cargo: { select: { id: true, nombre: true } }
                    }
                }
            }
        });
    }
}