//src/modules/RRHH/solicitudes/use-cases/obtenerHistorialSolicitud.useCase.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { rol_usuario_enum } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { construirFiltroConsulta } from '../helpers/validacionesSolicitud.helper';
import { convertirJsonAObjeto, obtenerAccionNegocio } from '../helpers/historialSolicitud.helper';

/**
 * Caso de uso para obtener el historial de auditoría de una solicitud de RRHH.
 * Este caso de uso tiene como objetivo recuperar los registros de auditoría relacionados con una solicitud específica desde la base de datos.
 * Se incluyen detalles sobre las acciones realizadas, los actores involucrados y los cambios en el estado de la solicitud.
 */
@Injectable()
export class ObtenerHistorialSolicitudUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para obtener el historial de auditoría de una solicitud de RRHH.
     * @param idOCodigo - El ID o código de la solicitud para la cual se desea obtener el historial.
     * @param empleadoIdSesion - El ID del empleado que está solicitando el historial (puede ser null si el rol es ADMIN o RRHH).
     * @param rol - El rol del usuario que está solicitando el historial (ADMIN, RRHH o EMPLEADO).
     * @returns - Una promesa que resuelve con un arreglo de registros de auditoría, cada uno conteniendo información sobre la acción realizada, el actor y los cambios en el estado de la solicitud.
     * @throws NotFoundException - Si la solicitud no existe o no está disponible para el usuario que realiza la consulta.
     */
    async execute(idOCodigo: string, empleadoIdSesion: string | null, rol: rol_usuario_enum) {
        const solicitud = await this.prisma.solicitud.findFirst({
            where: construirFiltroConsulta(idOCodigo, empleadoIdSesion, rol),
            select: { id: true }
        });

        if (!solicitud) throw new NotFoundException('La solicitud no existe o no está disponible para su cuenta.');

        //Se obtienen los registros de auditoría relacionados con la solicitud, 
        //ordenados por fecha de creación y ID, e incluyendo información sobre el usuario que realizó cada acción.
        const auditorias = await this.prisma.audit_log.findMany({
            where: { tabla_afectada: 'solicitud', registro_id: solicitud.id },
            orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
            include: { usuarios: { select: { id: true, email: true, empleados: { select: { nombre: true, apellido: true } } } } }
        });

        //Se mapea cada registro de auditoría para incluir información relevante sobre la acción realizada, 
        //el actor y los cambios en el estado de la solicitud.
        return auditorias.map((registro) => {
            const antes = convertirJsonAObjeto(registro.valores_antes);
            const despues = convertirJsonAObjeto(registro.valores_despues);

            //Se construye un objeto que representa el registro de auditoría, 
            //incluyendo detalles sobre la acción, el actor y los cambios en el estado de la solicitud.
            return {
                id: registro.id,
                accion: obtenerAccionNegocio(registro.accion, antes, despues),
                fecha: registro.created_at,
                actor: registro.usuarios ? {
                    id: registro.usuarios.id,
                    email: registro.usuarios.email,
                    nombre_completo: `${registro.usuarios.empleados?.nombre ?? ''} ${registro.usuarios.empleados?.apellido ?? ''}`.trim()
                } : { id: null, email: null, nombre_completo: 'Sistema' },
                cambios: {
                    estado: { anterior: antes.estado ?? null, nuevo: despues.estado ?? null },
                    responsable_id: { anterior: antes.responsable_id ?? null, nuevo: despues.responsable_id ?? null },
                    observacion: { anterior: antes.observacion ?? null, nuevo: despues.observacion ?? null }
                }
            };
        });
    }
}
