//src/modules/core/auth/use-cases/logout.useCase.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/common/prisma/prisma.service';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/common/cls/redis.constants';
import { obtenerSecretoJwt } from '../helpers/auth-token.helper';

/**
 * Caso de uso para el logout de usuarios internos.
 * Este caso de uso se encarga de invalidar el refresh token en la base de datos y bloquear el access token en Redis,
 * asegurando que el usuario no pueda seguir utilizando los tokens después de cerrar sesión.
 * @requires - PrismaService para interactuar con la base de datos.
 * @requires - JwtService para decodificar y manejar tokens JWT.
 * @requires - Redis para bloquear el access token en la lista negra.
 */
@Injectable()
export class LogoutUseCase {
  private readonly logger = new Logger(LogoutUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis //Inyección del cliente Redis para manejar la lista negra de tokens
  ) {}

  /**
   * Metodo principal para ejecutar el caso de uso de logout.
   * @param refreshToken - Refresh token que se desea invalidar en la base de datos.
   * @param accessToken - Access token que se desea bloquear en Redis.
   * @returns - Promesa que se resuelve cuando ambos tokens han sido procesados.
   * @throws - Lanza un error si ocurre un problema al interactuar con la base de datos o Redis.
   */
  async execute(refreshToken?: string, accessToken?: string, cerrarTodasLasSesiones = false): Promise<void> {
    await this.invalidateRefreshToken(refreshToken, cerrarTodasLasSesiones);
    await this.blacklistAccessToken(accessToken);
  }

  /**
   * Metodo privado para invalidar el refresh token en la base de datos.
   * @param refreshToken - Refresh token que se desea invalidar.
   * @param cerrarTodasLasSesiones - Indica si se deben invalidar todos los refresh tokens del usuario.
   * @returns - Promesa que se resuelve cuando el refresh token ha sido invalidado.
   */
  private async invalidateRefreshToken(refreshToken?: string, cerrarTodasLasSesiones = false): Promise<void> {
    if (!refreshToken) return;

    // Intentar decodificar el refresh token para obtener el ID del usuario y el JTI (JWT ID)
    try {
      const payload = this.jwtService.verify(refreshToken, { secret: obtenerSecretoJwt('REFRESH') }) as { sub?: string; jti?: string };

      if (!payload.sub) return;

      await this.prisma.tokens_seguridad.updateMany({
        where: {
          usuario_id: payload.sub,
          proposito: 'REFRESH_TOKEN',
          usado: false,
          ...(!cerrarTodasLasSesiones && payload.jti ? { id: payload.jti } : {}),
        },
        data: { usado: true },
      });
    } catch (err: any) {
      this.logger.warn(`No se pudo decodificar refresh token en logout: ${err.message}`);
    }
  }

  private async blacklistAccessToken(accessToken?: string): Promise<void> {
    if (!accessToken) return;

    try {
      const decoded = this.jwtService.verify(accessToken, {
        secret: obtenerSecretoJwt('ACCESS'),
      }) as { exp?: number; jti?: string };
      const ttlRestante = this.getRemainingTtl(decoded.exp);

      if (ttlRestante <= 0) return;

      if (decoded.jti) {
        await this.redis.set(`blacklist:jti:${decoded.jti}`, 'revoked', 'EX', ttlRestante);
      }

      await this.redis.set(`blacklist:jwt:${accessToken}`, 'revoked', 'EX', ttlRestante);
    } catch (err: any) {
      this.logger.warn(`No se pudo agregar token a lista negra: ${err.message}`);
    }
  }

  private getRemainingTtl(exp?: number): number {
    if (!exp) return 0;
    return exp - Math.floor(Date.now() / 1000);
  }
}
