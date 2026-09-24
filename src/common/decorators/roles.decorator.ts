//src/common/decorators/roles.decorator.ts
//Decorador para definir los roles permitidos en un endpoint, se utiliza junto con el RolesGuard
import { SetMetadata } from '@nestjs/common';

/**
 * Decorador que define los roles permitidos para acceder a un endpoint.
 * Este decorador se utiliza junto con el RolesGuard para proteger las rutas que requieren ciertos roles de usuario.
 * @param roles - Lista de roles permitidos para acceder al endpoint.
 * @returns Un decorador que establece los metadatos de roles en el manejador del endpoint.
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
