//src/modules/core/usuarios/use-cases/cambiarMiPassword.useCase.ts
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Caso de uso para cambiar la contraseña del usuario autenticado.
 * Este caso de uso permite al usuario cambiar su propia contraseña, verificando primero la contraseña actual
 * y luego actualizando la contraseña en la base de datos con un hash seguro.
 */
@Injectable()
export class CambiarMiPasswordUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cambia la contraseña del usuario autenticado.
   * Verifica que la contraseña actual sea correcta y que la nueva contraseña cumpla con los requisitos de seguridad.
   * Luego, actualiza la contraseña en la base de datos y marca todos los tokens de seguridad como usados para invalidar sesiones activas.
   * @param usuarioId - El ID del usuario autenticado que desea cambiar su contraseña.
   * @param passwordActual - La contraseña actual del usuario, que se verificará antes de permitir el cambio.
   * @param nuevaPassword - La nueva contraseña que el usuario desea establecer. Debe tener al menos 8 caracteres y ser diferente de la contraseña actual.
   * @returns - Un objeto con un mensaje de éxito si la contraseña se actualizó correctamente.
   * @throws - Lanza excepciones `BadRequestException`, `NotFoundException` o `UnauthorizedException` si la verificación falla o si el usuario no es válido.
   */
  async cambiarMiPassword( usuarioId: string, passwordActual: string, nuevaPassword: string ) {
    if (!passwordActual || !nuevaPassword || nuevaPassword.length < 8) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres.');
    }

    // Recupera el usuario de la base de datos para verificar su estado y contraseña actual.
    const usuario = await this.prisma.usuarios.findUnique({ where: { id: usuarioId }});

    if (!usuario?.activo || usuario.deleted_at !== null) {
      throw new NotFoundException('Usuario no encontrado o inactivo.');
    }

    // Verifica que la contraseña actual proporcionada coincida con el hash almacenado en la base de datos.
    const coincideActual = await argon2.verify(usuario.password_hash, passwordActual);
    if (!coincideActual) throw new UnauthorizedException({
      title: 'Contraseña Incorrecta',
      detail: 'La contraseña actual ingresada no es correcta.',
      campo: 'password_actual',
    });
    
    // Verifica que la nueva contraseña no sea idéntica a la actual para evitar cambios redundantes.
    if (await argon2.verify(usuario.password_hash, nuevaPassword)) throw new BadRequestException({
      title: 'Contraseña Idéntica',
      detail: 'La nueva contraseña debe ser diferente a la contraseña actual.',
      campo: 'nueva_password',
    });
    
    // Genera un nuevo hash seguro para la nueva contraseña utilizando Argon2.
    const nuevoHash = await argon2.hash(nuevaPassword, { type: argon2.argon2id });

    // Actualiza la contraseña en la base de datos y marca todos los tokens de seguridad como usados para invalidar sesiones activas.
    await this.prisma.$transaction(async (tx) => {
      await tx.usuarios.update({
        where: { id: usuarioId },
        data: { password_hash: nuevoHash },
      });

      await tx.tokens_seguridad.updateMany({
        where: { usuario_id: usuarioId, proposito: 'REFRESH_TOKEN', usado: false },
        data: { usado: true },
      });
    });

    // Retorna un mensaje de éxito indicando que la contraseña se actualizó correctamente.
    return { message: 'Contraseña actualizada exitosamente.' };
  }
}