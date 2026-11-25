//src/modules/core/usuarios/use-cases/gestionUsuarios.useCase.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { validarJerarquiaProvision } from '../../auth/helpers/auth-token.helper';
import type {
  ListarUsuariosQuery,
  RolUsuario,
} from '@jyp/shared-contracts';

/**
 * Caso de uso para la administración integral de cuentas de usuario (`USR-M1`):
 * - Listar usuarios con paginación y filtros (`rol`, `activo`, `search`).
 * - Activar o desactivar una cuenta invalidando todas sus sesiones activas (`tokens_seguridad`).
 * - Cambiar el rol de un usuario respetando la jerarquía de privilegios (`AUTH-F1`) e invalidando sus sesiones.
 */
@Injectable()
export class GestionUsuariosUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: ListarUsuariosQuery) {
    //El contrato ya normalizó página, límite y estado; solo se aplican valores por defecto.
    const page = filtros.page ?? 1;
    const limit = filtros.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.usuariosWhereInput = { deleted_at: null };
    //filtros.rol es un rol válido del contrato: ya no requiere un cast que podía romper Prisma.
    if (filtros.rol) where.rol = filtros.rol;
    if (typeof filtros.activo === 'boolean') where.activo = filtros.activo;

    // Si se proporciona un término de búsqueda, 
    // se divide en palabras y se construye una condición OR para buscar coincidencias en `email`, 
    // `nro_documento`, `nombre` y `apellido` de los empleados relacionados.
    if (filtros.search?.trim()) {
      const terminos = filtros.search.trim().split(/\s+/);
      where.AND = terminos.map((termino) => ({
        OR: [
          { email: { contains: termino, mode: 'insensitive' } },
          { empleados: { nro_documento: { contains: termino, mode: 'insensitive' }, }, },
          { empleados: { nombre: { contains: termino, mode: 'insensitive' } } },
          { empleados: { apellido: { contains: termino, mode: 'insensitive' } } },
        ],
      }));
    }

    // Se ejecuta una transacción para obtener el total de usuarios que cumplen con los filtros y la lista paginada de usuarios.
    const [total, usuarios] = await this.prisma.$transaction([
      this.prisma.usuarios.count({ where }),
      this.prisma.usuarios.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          email: true,
          rol: true,
          activo: true,
          ultimo_acceso: true,
          created_at: true,
          empleados: {
            select: {
              id: true,
              nro_documento: true,
              nombre: true,
              apellido: true,
              estado_laboral: true,
              area: { select: { id: true, nombre: true } },
              cargo: { select: { id: true, nombre: true } },
            },
          },
        },
      }),
    ]);

    return {
      data: usuarios,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Cambia el estado activo de un usuario (`activo` o `inactivo`) respetando la jerarquía de privilegios y evitando que un usuario se desactive a sí mismo.
   * @param usuarioObjetivoId - El ID del usuario cuyo estado se desea cambiar.
   * @param activo - El nuevo estado activo del usuario (true para activo, false para inactivo).
   * @param actor - Un objeto que representa al usuario que realiza la acción, incluyendo su ID y rol.
   * @returns - Un objeto con la información del usuario actualizado, incluyendo su ID, email, rol y estado activo.
   */
  async cambiarEstado(
    usuarioObjetivoId: string,
    activo: boolean,
    actor: { id: string; rol: string }
  ) {
    if (usuarioObjetivoId === actor.id && !activo) {
      throw new BadRequestException(
        'No puede desactivar su propia cuenta de usuario.'
      );
    }

    // Recupera el usuario objetivo de la base de datos para verificar su existencia y estado.
    const objetivo = await this.prisma.usuarios.findUnique({
      where: { id: usuarioObjetivoId },
      include: { empleados: { select: { activo: true, deleted_at: true } } },
    });

    // Si el usuario objetivo no existe o ha sido eliminado, lanza una excepción indicando que no se encontró el usuario.
    if (objetivo?.deleted_at !== null) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    // Valida la jerarquía de privilegios entre el actor y el usuario objetivo para asegurar
    // que el actor tenga permisos suficientes para cambiar el estado del usuario objetivo.
    validarJerarquiaProvision(actor.rol, objetivo.rol);

    // Si se intenta reactivar un usuario cuyo vínculo laboral está inactivo o cesado, lanza una excepción indicando que no se puede reactivar la cuenta.
    if (
      activo &&
      (!objetivo.empleados?.activo || objetivo.empleados.deleted_at !== null)
    ) {
      throw new BadRequestException(
        'No se puede reactivar la cuenta de un colaborador cuyo vínculo laboral está inactivo o cesado.'
      );
    }

    // Realiza la transacción para actualizar el estado activo del usuario y, si se desactiva,
    // marca todos sus tokens de seguridad como usados para invalidar sesiones activas.
    return this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.usuarios.update({
        where: { id: usuarioObjetivoId },
        data: { activo },
        select: { id: true, email: true, rol: true, activo: true },
      });

      if (!activo) {
        await tx.tokens_seguridad.updateMany({
          where: { usuario_id: usuarioObjetivoId, usado: false },
          data: { usado: true },
        });
      }

      return actualizado;
    });
  }

  /**
   * Cambia el rol de un usuario respetando la jerarquía de privilegios y evitando que un usuario se cambie a sí mismo.
   * @param usuarioObjetivoId - El ID del usuario cuyo rol se desea cambiar.
   * @param nuevoRol - El nuevo rol que se desea asignar al usuario objetivo.
   * @param actor - Un objeto que representa al usuario que realiza la acción, incluyendo su ID y rol.
   * @returns - Un objeto con la información del usuario actualizado, incluyendo su ID, email, rol y estado activo.
   */
  async cambiarRol(
    usuarioObjetivoId: string,
    nuevoRol: RolUsuario,
    actor: { id: string; rol: string }
  ) {
    if (usuarioObjetivoId === actor.id) {
      throw new ForbiddenException('No puede modificar su propio rol.');
    }

    // Valida la jerarquía de privilegios entre el actor y el nuevo rol que se desea asignar al usuario objetivo.
    validarJerarquiaProvision(actor.rol, nuevoRol);

    // Recupera el usuario objetivo de la base de datos para verificar su existencia y estado.
    const objetivo = await this.prisma.usuarios.findUnique({
      where: { id: usuarioObjetivoId },
    });

    // Si el usuario objetivo no existe o ha sido eliminado, lanza una excepción indicando que no se encontró el usuario.
    if (objetivo?.deleted_at !== null) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    // Valida la jerarquía de privilegios entre el actor y el rol actual del usuario objetivo para asegurar
    // que el actor tenga permisos suficientes para cambiar el rol del usuario objetivo.
    validarJerarquiaProvision(actor.rol, objetivo.rol);

    // Realiza la transacción para actualizar el rol del usuario y marcar todos sus tokens de seguridad como usados para invalidar sesiones activas.
    return this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.usuarios.update({
        where: { id: usuarioObjetivoId },
        data: { rol: nuevoRol },
        select: { id: true, email: true, rol: true, activo: true },
      });

      await tx.tokens_seguridad.updateMany({
        where: { usuario_id: usuarioObjetivoId, usado: false },
        data: { usado: true },
      });

      return actualizado;
    });
  }
}
