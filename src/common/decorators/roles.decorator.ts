//src/common/decorators/roles.decorator.ts
//Decorador para definir los roles permitidos en un endpoint, se utiliza junto con el RolesGuard
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);