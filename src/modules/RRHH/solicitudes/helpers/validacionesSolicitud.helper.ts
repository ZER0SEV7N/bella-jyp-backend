import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { rol_usuario_enum } from '@prisma/client';
import type { PrismaService } from '@/common/prisma/prisma.service';

export const SOLICITUD_INCLUDE = {
    empleados: {
        select: {
            id: true, nombre: true, apellido: true, nro_documento: true, fecha_inicio: true,
            area: { select: { id: true, nombre: true } },
            cargo: { select: { id: true, nombre: true } }
        }
    },
    responsable: {
        select: { id: true, email: true, rol: true, empleados: { select: { nombre: true, apellido: true } } }
    }
} satisfies Prisma.solicitudInclude;

const SOLICITUD_OPERATIVA_SELECT = {
    id: true, codigo: true, estado: true, responsable_id: true, observacion: true
} satisfies Prisma.solicitudSelect;

export type SolicitudOperativa = Prisma.solicitudGetPayload<{ select: typeof SOLICITUD_OPERATIVA_SELECT }>;

export function construirFiltroConsulta(identificador: string, empleadoId: string | null, rol: rol_usuario_enum): Prisma.solicitudWhereInput {
    if (!['ADMIN', 'RRHH', 'CONTADOR', 'EMPLEADO'].includes(rol))
        throw new ForbiddenException('Su rol no tiene acceso a las solicitudes de RRHH.');

    const valor = identificador.trim();
    const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);

    if (!esUuid && !/^SOL-\d{4}-\d{3,}$/.test(valor))
        throw new BadRequestException('Debe proporcionar un UUID o un código SOL-YYYY-NNN válido.');

    if (rol === 'EMPLEADO' && !empleadoId)
        throw new ForbiddenException('La cuenta no tiene un colaborador asociado.');

    return {
        ...(esUuid ? { id: valor } : { codigo: valor }),
        // Las anulaciones antiguas también se conservan para consulta.
        OR: [{ deleted_at: null }, { estado: 'ANULADA' }],
        ...(rol === 'EMPLEADO' ? { empleado_id: empleadoId! } : {})
    };
}

export async function obtenerSolicitudOperativa(prisma: PrismaService, solicitudId: string): Promise<SolicitudOperativa> {
    const solicitud = await prisma.solicitud.findUnique({
        where: { id: solicitudId, deleted_at: null },
        select: SOLICITUD_OPERATIVA_SELECT
    });

    if (!solicitud) throw new NotFoundException('La solicitud especificada no existe o ha sido eliminada.');

    return solicitud;
}

export function validarSolicitudAbierta(solicitud: SolicitudOperativa): void {
    if (solicitud.estado !== 'PENDIENTE' && solicitud.estado !== 'EN_REVISION')
        throw new ConflictException({ title: 'Solicitud finalizada', detail: `La solicitud ${solicitud.codigo} se encuentra en estado ${solicitud.estado}.` });
}

export function validarResponsable(solicitud: SolicitudOperativa, usuarioId: string): void {
    if (solicitud.estado !== 'EN_REVISION')
        throw new ConflictException('La solicitud debe encontrarse en EN_REVISION antes de ser evaluada.');

    if (!solicitud.responsable_id) throw new ConflictException('La solicitud no tiene un responsable asignado.');

    if (solicitud.responsable_id !== usuarioId)
        throw new ForbiddenException('Solo el responsable asignado puede evaluar esta solicitud.');
}

export async function verificarRevisorActivo(prisma: PrismaService, usuarioId: string): Promise<void> {
    const usuario = await prisma.usuarios.findUnique({
        where: { id: usuarioId },
        select: { id: true, rol: true, activo: true, deleted_at: true }
    });

    if (!usuario?.activo || usuario.deleted_at || !['ADMIN', 'RRHH'].includes(usuario.rol))
        throw new ForbiddenException('El responsable debe ser un usuario activo con rol ADMIN o RRHH.');
}

export function validarMotivo(motivo: string | null | undefined, titulo: string): string {
    if (typeof motivo !== 'string' || motivo.trim().length < 5 || motivo.trim().length > 2000)
        throw new BadRequestException({ title: titulo, detail: 'Debe ingresar un motivo descriptivo de entre 5 y 2000 caracteres.' });

    return motivo.trim();
}

export function construirCondicionActual(solicitud: SolicitudOperativa): Prisma.solicitudWhereUniqueInput {
    // La condición se evalúa dentro del UPDATE, no solo en la lectura anterior.
    return { id: solicitud.id, estado: solicitud.estado, responsable_id: solicitud.responsable_id, deleted_at: null };
}

export function lanzarConflictoSiCambio(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')
        throw new ConflictException({ title: 'Solicitud modificada', detail: 'Otro usuario modificó la solicitud. Actualice el detalle antes de continuar.' });

    throw error;
}
