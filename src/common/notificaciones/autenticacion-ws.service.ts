//src/common/alertas/autenticacion-ws.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { Socket } from 'socket.io';

/**
 * Servicio de autenticación para conexiones WebSocket.
 * Este servicio se encarga de autenticar a los usuarios que intentan establecer una conexión WebSocket con el servidor.
 * Utiliza tokens JWT para verificar la identidad del usuario y garantizar que solo los usuarios autorizados puedan acceder a los servicios en tiempo real.
 */

@Injectable()
export class AutenticacionWsService {
    constructor(
        private readonly jwt: JwtService,
        private readonly prisma: PrismaService
    ) {}

    /**
     * Funcion asincrónica que autentica a un usuario mediante un token JWT proporcionado en la conexión WebSocket.
     * Verifica la validez del token, recupera la información del usuario desde la base de datos y asegura que el usuario esté activo y no haya sido eliminado.
     * @param token - El token JWT proporcionado por el cliente para autenticar la conexión WebSocket.
     * @param socket - El objeto Socket que representa la conexión WebSocket del cliente.
     * @returns - Una promesa que resuelve un objeto con la información del usuario autenticado, incluyendo su ID, rol y tiempo de expiración del token.
     * @throws - Lanza una excepción UnauthorizedException si el token es inválido, el usuario está inactivo o ha sido eliminado.
     */
    async autenticar(socket: Socket) {
        //Extrae el token JWT de los encabezados de la solicitud o del objeto de autenticación del socket.
        const authorization = socket.handshake.headers.authorization;
        
        //Verifica si el token está presente en los encabezados o en el objeto de autenticación del socket.
        const token: unknown = socket.handshake.auth?.token ?? authorization?.replace(/^Bearer /i, '');
        
        //Si el token no es una cadena de texto, lanza una excepción indicando que se requiere un token de acceso.
        if (typeof token !== 'string') 
            throw new UnauthorizedException('Access Token requerido.');
        
        //Verifica y decodifica el token JWT utilizando el servicio JwtService, asegurándose de que sea válido y no haya expirado.
        const payload = await this.jwt.verifyAsync<{ sub: string; exp: number }>(token, { algorithms: ['HS256'], maxAge: '15m' });
        
        //Si el payload del token no contiene un identificador de usuario (sub) o una fecha de expiración válida (exp), lanza una excepción indicando que el token es inválido.
        if (!payload.sub || !Number.isFinite(payload.exp)) 
            throw new UnauthorizedException('Token inválido.');

        //Recupera la información del usuario desde la base de datos utilizando el servicio PrismaService, asegurándose de que el usuario esté activo y no haya sido eliminado.
        const usuario = await this.prisma.usuarios.findUnique({
            where: { id: payload.sub },
            select: { id: true, rol: true, activo: true, deleted_at: true },
        });

        //Si el usuario no está activo o ha sido eliminado, lanza una excepción indicando que el usuario está inactivo.
        if (!usuario?.activo || usuario.deleted_at) 
            throw new UnauthorizedException('Usuario inactivo.');

        //Devuelve un objeto con la información del usuario autenticado, incluyendo su ID, rol y tiempo de expiración del token.
        return { id: usuario.id, rol: usuario.rol, exp: payload.exp };
    }

    /**
     * Funcion asincrónica que verifica si un usuario sigue vigente en el sistema.
     * Comprueba si el usuario con el ID proporcionado sigue activo, no ha sido eliminado y tiene el rol especificado.
     * @param id - El identificador único del usuario que se desea verificar.
     * @param rol - El rol que se espera que tenga el usuario para considerarlo vigente.
     * @returns - Una promesa que resuelve un valor booleano indicando si el usuario sigue vigente (true) o no (false).
     */
    async sigueVigente(id: string, rol: string): Promise<boolean> {
        const usuario = await this.prisma.usuarios.findUnique({ 
            where: { id }, 
            select: { activo: true, deleted_at: true, rol: true } 
        });
        
        return Boolean(usuario?.activo && !usuario.deleted_at && usuario.rol === rol);
    }
}
