//src/common/guards/jwt-access.guard.ts
//Guard para proteger las rutas que requieren autenticación con JWT
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAccessGuard extends AuthGuard('jwt') {
    //Sobrescribe el método handleRequest para lanzar una excepción personalizada en caso de que el token no sea válido
    handleRequest(err: any, user: any, info: any){
        //Interceptar el fallo de autenticación y lanzar una excepción personalizada
        if(err || !user) throw err || new UnauthorizedException({
            type: 'https://api.jyp.com/errors/unauthorized',
            title: 'Sesión Inválida o Expirada',
            status: 401,
            detail: 'Debe proveer un Access Token válido para consumir este recurso.',
        });
    return user;
    }
}