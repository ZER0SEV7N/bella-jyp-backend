//src/modules/core/auth/use-cases/RefrescarToken.useCase.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Caso de uso para refrescar el token de acceso utilizando un token de actualización válido.
 * Este caso de uso verifica la validez del token de actualización proporcionado por el cliente,
 * y si es válido, genera un nuevo token de acceso para el usuario. También se asegura de que el usuario
 * esté activo y no haya sido eliminado.
 */
@Injectable()
export class RefrescarTokenUseCase {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Ejecuta el caso de uso para refrescar el token de acceso.
   * @param refreshToken El token de actualización proporcionado por el cliente.
   * @returns Un objeto que contiene el nuevo token de acceso.
   * @throws UnauthorizedException si el token de actualización es inválido o no se encuentra en la base de datos.
   */
  async execute(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token no proporcionado.');

    try {
      //Verificar la firma del refresh token utilizando el secreto específico para refresh tokens
      const payload = this.jwtService.verify(refreshToken, {secret: process.env.JWT_REFRESH_SECRET || 'jyp-dev-refresh-secret-1234'});

      const userId = payload.sub || payload.id; //Obtener el ID del usuario desde el payload del token

      //Verificacion critica en la base de datos: Comprobar que el refresh token existe y está activo para el usuario
      const user = await this.prisma.usuarios.findUnique({
        where: { id: userId },
        include: {
          empleados: {
            select: {
              nombre: true,
              apellido: true,
              nro_documento: true
            }
          }
        }
      });

      if (!user?.activo || user.deleted_at !== null)
        throw new UnauthorizedException('Usuario no encontrado o inactivo.');

      // Validar que no haya sido revocado en tokens_seguridad
      const tokenActivo = await this.prisma.tokens_seguridad.findFirst({
        where: {
          usuario_id: user.id,
          proposito: 'REFRESH_TOKEN',
          usado: false,
          expira_en: { gt: new Date() }
        },
      });

      if (!tokenActivo) throw new UnauthorizedException('Sesión cerrada o token revocado.');
      
      //Construir el nuevo payload para el access token
      const nombreCompleto = user.empleados ? `${user.empleados.nombre ?? ''} ${user.empleados.apellido ?? ''}`.trim() : 'Usuario del Sistema';

      const nuevoPayload = {
        sub: user.id,
        email: user.email,
        roles: user.rol,
        doc: payload.doc || user.empleado_id,
        empId: user.empleado_id,
        nombre: nombreCompleto,
      };

      //Generar un nuevo access token y refresh token en paralelo
      const [newAccessToken, newRefreshToken] = await Promise.all([
        this.jwtService.signAsync(nuevoPayload, { secret: process.env.JWT_ACCESS_SECRET || 'jyp-dev-secret-key-1234', expiresIn: '15m' }),
        this.jwtService.signAsync(nuevoPayload, { secret: process.env.JWT_REFRESH_SECRET || 'jyp-dev-refresh-secret-1234', expiresIn: '7d' }),
      ]);

      //Persistir el nuevo refresh token en la base de datos y marcar el anterior como usado
      const hashedRT = await argon2.hash(newRefreshToken, { type: argon2.argon2id });

      //Usar una transacción para asegurar que ambos cambios (marcar el token anterior como usado y crear el nuevo token) se realicen de manera atómica
      await this.prisma.$transaction([
        this.prisma.tokens_seguridad.update({ where: { id: tokenActivo.id }, data: { usado: true } }),
        this.prisma.tokens_seguridad.create({
          data: {
            id: crypto.randomUUID(),
            usuario_id: user.id,
            token_hash: hashedRT,
            proposito: 'REFRESH_TOKEN',
            expira_en: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            usado: false
          }
        })
      ]);

      return { accessToken: newAccessToken, newRefreshToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Refresh token inválido o expirado.', { cause: error });
    }
  }
}