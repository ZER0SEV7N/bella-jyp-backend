//src/modules/RRHH/solicitudes/helpers/validacionesSolicitud.helper.ts
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { rol_usuario_enum } from '@prisma/client';
import type { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Constante que define la estructura de inclusión para las consultas de solicitudes, incluyendo información del empleado y del responsable.
 * Se utiliza para obtener detalles completos de la solicitud junto con los datos relevantes del empleado y del responsable asignado.
 * @type {Prisma.solicitudInclude}
 * @readonly - Indica que la constante no debe ser modificada después de su definición.
 */
export const SOLICITUD_INCLUDE = {
  empleados: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      nro_documento: true,
      fecha_inicio: true,
      area: { select: { id: true, nombre: true } },
      cargo: { select: { id: true, nombre: true } },
    },
  },
  responsable: { select: { id: true, email: true, rol: true, empleados: { select: { nombre: true, apellido: true } } } },
} satisfies Prisma.solicitudInclude;

//Constante que define la estructura de selección para las consultas de solicitudes operativas, incluyendo solo los campos relevantes para la operación.
const SOLICITUD_OPERATIVA_SELECT = {
  empleado_id: true,
  fecha_inicio: true,
  fecha_fin: true,
  id: true,
  codigo: true,
  estado: true,
  responsable_id: true,
  observacion: true,
  tipo: true,
  efecto_asistencia: true,
} satisfies Prisma.solicitudSelect;

//Tipo que representa una solicitud operativa, utilizando la estructura de selección definida en SOLICITUD_OPERATIVA_SELECT.
export type SolicitudOperativa = Prisma.solicitudGetPayload<{ select: typeof SOLICITUD_OPERATIVA_SELECT }>;

/**
 * Función que construye un filtro de consulta para buscar solicitudes según el identificador proporcionado, el empleado y el rol del usuario.
 * @param identificador - El identificador de la solicitud, que puede ser un UUID o un código en formato SOL-YYYY-NNN.
 * @param empleadoId - El identificador del empleado que realiza la consulta (puede ser null si el rol es ADMIN o RRHH).
 * @param rol - El rol del usuario que realiza la consulta (ADMIN, RRHH, CONTADOR o EMPLEADO).
 * @returns - Un objeto Prisma.solicitudWhereInput que representa el filtro de consulta construido.
 * @throws - Lanza excepciones de ForbiddenException o BadRequestException si el rol del usuario no tiene acceso a las solicitudes o si el identificador es inválido.
 */
export function construirFiltroConsulta(
  identificador: string,
  empleadoId: string | null,
  rol: rol_usuario_enum
): Prisma.solicitudWhereInput {
  //Valida que el identificador proporcionado sea un UUID o un código en formato SOL-YYYY-NNN, lanzando una excepción si no cumple con el formato esperado.
  const valor = identificador.trim();
  const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);

  //Valida que el uuid o el código proporcionado sea válido según el rol del usuario, lanzando excepciones si no cumple con los criterios de acceso.
  if (!esUuid && !/^SOL-\d{4}-\d{3,}$/.test(valor))
    throw new BadRequestException('Debe proporcionar un UUID o un código SOL-YYYY-NNN válido.');

  //Valida que el rol del usuario sea el de EMPLEADO y que tenga un colaborador asociado, lanzando una excepción si no cumple con los criterios de acceso.
  if (rol === 'EMPLEADO' && !empleadoId) throw new ForbiddenException('La cuenta no tiene un colaborador asociado.');

  //Construye y devuelve el filtro de consulta según el identificador, el empleado y el rol del usuario, incluyendo condiciones para solicitudes anuladas y eliminadas.
  return {
    ...(esUuid ? { id: valor } : { codigo: valor }),
    // Las anulaciones antiguas también se conservan para consulta.
    OR: [{ deleted_at: null }, { estado: 'ANULADA' }],
    ...(rol === 'EMPLEADO' ? { empleado_id: empleadoId } : {}),
  };
}

/**
 * Función que obtiene una solicitud operativa desde la base de datos utilizando PrismaService, según el identificador de la solicitud proporcionado.
 * @param prisma - Instancia de PrismaService utilizada para interactuar con la base de datos.
 * @param solicitudId - El identificador de la solicitud que se desea obtener.
 * @returns - Una promesa que resuelve a un objeto SolicitudOperativa que representa la solicitud obtenida.
 * @throws - Lanza una NotFoundException si la solicitud especificada no existe o ha sido eliminada.
 * @async - Indica que la función es asíncrona y devuelve una promesa.
 */
export async function obtenerSolicitudOperativa(prisma: PrismaService, solicitudId: string): Promise<SolicitudOperativa> {
  //Realiza una consulta a la base de datos para obtener la solicitud operativa según el identificador proporcionado, utilizando la estructura de selección definida en SOLICITUD_OPERATIVA_SELECT.
  const solicitud = await prisma.solicitud.findUnique({
    where: { id: solicitudId, deleted_at: null },
    select: SOLICITUD_OPERATIVA_SELECT,
  });

  //Valida que la solicitud obtenida no sea nula, lanzando una NotFoundException si la solicitud especificada no existe o ha sido eliminada.
  if (!solicitud) throw new NotFoundException('La solicitud especificada no existe o ha sido eliminada.');

  return solicitud;
}

export function validarResponsable(solicitud: SolicitudOperativa, usuarioId: string): void {
  if (solicitud.estado !== 'EN_REVISION')
    throw new ConflictException('La solicitud debe encontrarse en EN_REVISION antes de ser evaluada.');

  if (!solicitud.responsable_id) throw new ConflictException('La solicitud no tiene un responsable asignado.');

  if (solicitud.responsable_id !== usuarioId) throw new ForbiddenException('Solo el responsable asignado puede evaluar esta solicitud.');
}

export async function verificarRevisorActivo(prisma: PrismaService, usuarioId: string): Promise<void> {
  const usuario = await prisma.usuarios.findUnique({
    where: { id: usuarioId },
    select: { id: true, rol: true, activo: true, deleted_at: true },
  });

  if (!usuario?.activo || usuario.deleted_at || !['ADMIN', 'RRHH'].includes(usuario.rol))
    throw new ForbiddenException('El responsable debe ser un usuario activo con rol ADMIN o RRHH.');
}
