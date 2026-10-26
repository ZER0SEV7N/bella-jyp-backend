//src/modules/core/auth/use-cases/logout.useCase.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/common/prisma/prisma.service';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/common/cls/redis.constants';

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
  async execute(refreshToken?: string, accessToken?: string): Promise<void> {
    //Si se proporciona un refresh token, intentar invalidarlo en la base de datos
    if (refreshToken) {
      try {
        //Decodificar el refresh token para obtener el userId del payload
        const payload = this.jwtService.verify(refreshToken, {
          secret: process.env.JWT_REFRESH_SECRET || 'jyp-dev-refresh-secret-1234',
        }) as { sub?: string };

        //Extraer el userId del payload
        const userId = payload?.sub;

        //Si se obtiene un userId del payload, actualizar los tokens de seguridad en la base de datos para marcar el refresh token como usado
        if (userId)
          await this.prisma.tokens_seguridad.updateMany({
            where: {
              usuario_id: userId,
              proposito: 'REFRESH_TOKEN',
              usado: false,
            },
            data: { usado: true },
          });
      } catch (err: any) {
        this.logger.warn(`No se pudo decodificar refresh token en logout: ${err.message}`);
      }
    }

    //Bloquear Access Token en Redis por el tiempo restante de su vigencia
    if (accessToken) {
      try {
        //Decodificar el access token para obtener su tiempo de expiración
        const decoded = this.jwtService.verify(accessToken, { secret: process.env.JWT_ACCESS_SECRET || 'jyp-dev-secret-key-1234' }) as { exp?: number; };

        //Si el token tiene un tiempo de expiración, calcular el TTL restante y agregarlo a la lista negra en Redis
        if (decoded?.exp) {
          const ahoraSegundos = Math.floor(Date.now() / 1000);
          const ttlRestante = decoded.exp - ahoraSegundos;

          if (ttlRestante > 0) await this.redis.set(`blacklist:jwt:${accessToken}`, 'revoked', 'EX', ttlRestante);
        }
      } catch (err: any) {
        this.logger.warn(`No se pudo agregar token a lista negra: ${err.message}`);
      }
    }
  }
}
