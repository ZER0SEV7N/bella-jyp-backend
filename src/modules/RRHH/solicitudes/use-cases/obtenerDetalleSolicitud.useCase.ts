//src/modules/RRHH/solicitudes/use-cases/obtenerDetalleSolicitud.useCase.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Funcion auxiliar para calcular la antiguedad laboral en un formato legible (años, meses, días) 
 * a partir de una fecha de inicio.
 */
function calcularAntiguedad(fechaInicio: Date | null): string {
    if (!fechaInicio) return 'No registrada';

    const ahora = new Date();
    let años = ahora.getFullYear() - fechaInicio.getFullYear();
    let meses = ahora.getMonth() - fechaInicio.getMonth();

    //Si el mes actual es menor que el mes de inicio, ajustamos los años y meses
    if(meses < 0) {
        años--;
        meses += 12;
    }

    if(años === 0 && meses === 0) return 'Menos de 1 mes';
    if(años === 0 ) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    return `${años} ${años === 1 ? 'año' : 'años'} ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}

/**
 * Caso de uso para obtener el detalle de una solicitud de RRHH.
 * Este caso de uso tiene como objetivo recuperar la información detallada de una solicitud específica desde la base de datos.
 */
@Injectable()
export class ObtenerDetalleSolicitudUseCase {
    constructor(private readonly prisma: PrismaService) {}
    /**
     * Ejecuta el caso de uso para obtener el detalle de una solicitud de RRHH.
     * @param idOCodigo - El ID de la solicitud a recuperar.
     * @returns Una promesa que resuelve con el detalle de la solicitud.
     */
    async execute(idOCodigo: string) {
        //Buscar la solicitud por ID o código, incluyendo información del empleado y responsable
        const solicitud = await this.prisma.solicitud.findFirst({
             where: {
                OR: [{ id: idOCodigo }, { codigo: idOCodigo }],
                deleted_at: null
            },
            include: {
                empleados: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        nro_documento: true,
                        fecha_inicio: true,
                        area: { select: { id: true, nombre: true } },
                        cargo: { select: { id: true, nombre: true } }
                    }
                },
                responsable: {
                    select: {
                        id: true,
                        email: true,
                        rol: true,
                        empleados: { select: { nombre: true, apellido: true } }
                    }
                }
            }
        });

        if(!solicitud) throw new NotFoundException({
            title: 'Solicitud no encontrada',
            detail: `No se encontró ninguna solicitud con el ID o código '${idOCodigo}'.`
        })

        const hoy = new Date();
        hoy.setHours(0,0,0,0); //Normalizamos la fecha a medianoche para evitar problemas de zona horaria

        //Verificamos si la solicitud requiere atención inmediata: si el estado es 'PENDIENTE' y la fecha de inicio es hoy o ya ha pasado
        const periodoIniciaHoyOAntes = solicitud.fecha_inicio && new Date(solicitud.fecha_inicio) <= hoy;
        const requiereAtencionInmediata = solicitud.estado === 'PENDIENTE' && Boolean(periodoIniciaHoyOAntes);

        return {
            ...solicitud,
            colaborador_resumen: {
                id: solicitud.empleados.id,
                nombre_completo: `${solicitud.empleados.nombre} ${solicitud.empleados.apellido}`.trim(),
                documento: solicitud.empleados.nro_documento,
                area: solicitud.empleados.area.nombre ?? 'No registrada',
                cargo: solicitud.empleados.cargo.nombre ?? 'No registrado',
                antiguedad: calcularAntiguedad(solicitud.empleados.fecha_inicio)
            },
            alerta_urgencia: requiereAtencionInmediata ? {
                mensaje: 'Atención inmediata: el período inicia hoy o ya ha comenzado.',
                detalle: 'Esta solicitud debe resolverse antes de que finalice el día laboral.'
            } : null
        };
    }
}