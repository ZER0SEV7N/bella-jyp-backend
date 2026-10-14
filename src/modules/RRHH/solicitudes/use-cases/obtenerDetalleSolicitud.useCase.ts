//src/modules/RRHH/solicitudes/use-cases/obtenerDetalleSolicitud.useCase.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { rol_usuario_enum } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { calcularAntiguedad, obtenerAlertaUrgencia } from '../helpers/fechasSolicitud.helper';
import { SOLICITUD_INCLUDE, construirFiltroConsulta } from '../helpers/validacionesSolicitud.helper';

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
    async execute(idOCodigo: string, empleadoIdSesion: string | null, rol: rol_usuario_enum) {
        const solicitud = await this.prisma.solicitud.findFirst({
            where: construirFiltroConsulta(idOCodigo, empleadoIdSesion, rol),
            include: SOLICITUD_INCLUDE
        });

        if (!solicitud) throw new NotFoundException('La solicitud no existe o no está disponible para su cuenta.');

        return {
            ...solicitud,
            colaborador_resumen: {
                id: solicitud.empleados.id,
                nombre_completo: `${solicitud.empleados.nombre ?? ''} ${solicitud.empleados.apellido ?? ''}`.trim(),
                documento: solicitud.empleados.nro_documento,
                area: solicitud.empleados.area.nombre,
                cargo: solicitud.empleados.cargo.nombre,
                antiguedad: calcularAntiguedad(solicitud.empleados.fecha_inicio)
            },
            alerta_urgencia: obtenerAlertaUrgencia(solicitud)
        };
    }
}
