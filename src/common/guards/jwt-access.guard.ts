//src/common/guards/jwt-access.guard.ts
//Guard para proteger las rutas que requieren autenticación con JWT
import { ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { REDIS_CLIENT } from '../config/redis/redis.constants';
import Redis from 'ioredis';
import { FastifyRequest } from 'fastify';

/**
 * Guard que protege las rutas que requieren autenticación con JWT.
 * Extiende de AuthGuard('jwt') para utilizar la estrategia de Passport para JWT.
 * Sobrescribe el método handleRequest para lanzar una excepción personalizada en caso de que el token no sea válido.
 */
@Injectable()
export class JwtAccessGuard extends AuthGuard('jwt') {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  /**
   * Verifica si el usuario tiene acceso a la ruta protegida.
   * @param context - Contexto de ejecución que contiene la solicitud HTTP.
   * @returns - Promesa que se resuelve en true si el usuario tiene acceso, o lanza una excepción UnauthorizedException si no lo tiene.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authHeader = request.headers.authorization;

    //Verificar si el Access Token actual está en la lista negra de Redis
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const isBlacklisted = await this.redis.get(`blacklist:jwt:${token}`);

      if (isBlacklisted) throw new UnauthorizedException({
        type: 'https://api.jyp.com/errors/unauthorized',
        title: 'Sesión Revocada',
        status: 401,
        detail: 'El token ha sido invalidado por cierre de sesión. Inicie sesión nuevamente.'
      });
    }

    return (await super.canActivate(context)) as boolean;
  }

  /**
   * Maneja la solicitud de autenticación y lanza una excepción personalizada si el usuario no está autenticado.
   * @param err - Error de autenticación, si existe.
   * @param user - Usuario autenticado, si la autenticación fue exitosa.
   * @returns El usuario autenticado si la autenticación fue exitosa.
   * @throws UnauthorizedException si el usuario no está autenticado o si ocurre un error de autenticación.
   */
  handleRequest(err: any, user: any) {
    if (err || !user) throw ( err ||
      new UnauthorizedException({
        type: 'https://api.jyp.com/errors/unauthorized',
        title: 'Sesión Inválida o Expirada',
        status: 401,
        detail: 'Debe proveer un Access Token válido para consumir este recurso.',
      }));
    
    return user;
  }
}