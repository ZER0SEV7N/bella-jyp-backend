//src/modules/core/auth/use-cases/RefrescarToken.useCase.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
    if (!refreshToken)
      throw new UnauthorizedException('Refresh token no proporcionado.');

    try {
      //Verificar la firma del refresh token utilizando el secreto específico para refresh tokens
      const payload = this.jwtService.verify(refreshToken, {secret: process.env.JWT_REFRESH_SECRET || 'jyp-dev-refresh-secret-1234'});

      const userId = payload.sub || payload.id; //Obtener el ID del usuario desde el payload del token

      //Verificacion critica en la base de datos: Comprobar que el refresh token existe y está activo para el usuario
      const user = await this.prisma.usuarios.findUnique({where: { id: userId }});

      if (!user?.activo || user.deleted_at !== null)
        throw new UnauthorizedException('Usuario no encontrado o inactivo.');

      //Emitir el nuevo access token para el usuario
      const newAccessToken = this.jwtService.sign({
          sub: user.id,
          email: user.email,
          roles: user.rol,
          doc: payload.doc || user.empleado_id,
          empId: user.empleado_id
        },
        {
          secret: process.env.JWT_ACCESS_SECRET || 'jyp-dev-secret-key-1234',
          expiresIn: '15m' //Tiempo de expiración del Access Token
        }
      );
      
      return { accessToken: newAccessToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Refresh token inválido o expirado.', {cause: error});
    }
  }
}
