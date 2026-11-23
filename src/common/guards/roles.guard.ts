//src/common/guards/roles.guard.ts
//Guard para proteger las rutas que requieren ciertos roles de usuario
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard que protege las rutas que requieren ciertos roles de usuario.
 * Este guard verifica si el usuario autenticado tiene al menos uno de los roles requeridos para acceder a la ruta.
 * Si el usuario no tiene los roles necesarios, se lanza una excepción ForbiddenException.
 * Si la ruta no tiene el decorador @Roles, entonces no se requiere ningún rol específico y se permite el acceso.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Verifica si el usuario tiene acceso a la ruta protegida según los roles requeridos.
   * @param context - Contexto de ejecución que contiene la solicitud HTTP y el usuario autenticado.
   * @returns boolean - Retorna true si el usuario tiene acceso, de lo contrario lanza una excepción ForbiddenException.
   * @throws ForbiddenException - Si el usuario no tiene los roles necesarios para acceder a la ruta.
   */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    //Si la ruta no tiene el decorador @Roles, entonces no se requiere ningún rol específico y se permite el acceso
    if (!requiredRoles || requiredRoles.length === 0) return true;

    //Se obtiene el usuario autenticado del contexto de ejecución
    const { user } = context.switchToHttp().getRequest();

    //Si el usuario no está autenticado o no tiene un rol definido, se lanza una excepción ForbiddenException
    if (!user || !requiredRoles.includes(user.rol))
      throw new ForbiddenException({
        type: 'https://api.jyp.com/errors/forbidden',
        title: 'Acceso Denegado',
        status: 403,
        detail: 'No tiene permisos para acceder a este recurso.'
      });
    return true;
  }
}
