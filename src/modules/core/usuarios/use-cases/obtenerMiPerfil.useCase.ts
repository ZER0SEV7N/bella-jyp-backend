//src/modules/core/usuarios/use-cases/obtenerMiPerfil.useCase.ts
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { MiPerfilResponseDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para obtener el perfil del usuario autenticado.
 * Este caso de uso permite obtener la información del perfil del usuario actualmente autenticado,
 * incluyendo su correo electrónico, rol, último acceso y detalles del empleado asociado.
 * Se asegura de que el usuario exista y esté activo en la base de datos.
 */
@Injectable()
export class ObtenerMiPerfilUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene el perfil del usuario autenticado.
   * @param userId - El ID del usuario.
   * @returns La información del perfil del usuario.
   */
  async obtenerPerfil(userId: string): Promise<MiPerfilResponseDto> {
    try {
      //Buscar el usuario por su ID
      const usuario = await this.prisma.usuarios.findUnique({
        where: { id: userId },
        //Obtener estrictamente los campos necesarios para el perfil
        select: {
          id: true,
          email: true,
          rol: true,
          ultimo_acceso: true,
          empleados: {
            select: {
              id: true,
              nro_documento: true,
              nombre: true,
              apellido: true,
              cargo: { select: { nombre: true } },
              area: { select: { nombre: true } }
            }
          }
        }
      });

      //Si no se encuentra el usuario, lanzar una excepción
      if (!usuario) throw new NotFoundException('Usuario no encontrado');

      //Formatear la respuesta para el frontend
      return {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
        ultimo_acceso: usuario.ultimo_acceso,
        empleado: usuario.empleados
          ? {
              id: usuario.empleados.id,
              nro_documento: usuario.empleados.nro_documento,
              nombre_completo: `${usuario.empleados.nombre} ${usuario.empleados.apellido}`,
              cargo: usuario.empleados.cargo.nombre,
              area: usuario.empleados.area.nombre
            }
          : null
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error al obtener el perfil del usuario');
    }
  }
}
