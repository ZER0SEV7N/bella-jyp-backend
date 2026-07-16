//src/common/guards/roles.guard.ts
//Guard para proteger las rutas que requieren ciertos roles de usuario
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        //Si la ruta no tiene el decorador @Roles, entonces no se requiere ningún rol específico y se permite el acceso
        if(!requiredRoles) return true;

        const { user } = context.switchToHttp().getRequest();

        if(!user || !requiredRoles.includes(user.rol)) throw new ForbiddenException({
            type: 'https://api.jyp.com/errors/forbidden',
            title: 'Acceso Denegado',
            status: 403,
            detail: 'No tiene permisos para acceder a este recurso.',
        });
    return true;
    }
}