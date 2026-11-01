import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AutenticacionWsService } from '@/common/notificaciones/autenticacion-ws.service';

describe('AutenticacionWsService - Identidad del socket', () => {
    it('Debe verificar el token y recuperar el rol vigente desde la BD', async () => {
        // Arrange: el rol del token no coincide con la BD; prevalece la BD.
        const jwt = {
            verifyAsync: jest
                .fn()
                .mockResolvedValue({
                    sub: 'usuario-demo',
                    exp: 1900000000,
                    rol: 'ADMIN',
                }),
        };
        const prisma = {
            usuarios: {
                findUnique: jest
                    .fn()
                    .mockResolvedValue({
                        id: 'usuario-demo',
                        rol: 'RRHH',
                        activo: true,
                        deleted_at: null,
                    }),
            },
        };
        const socket = {
            handshake: { auth: { token: 'jwt-demo' }, headers: {} },
        } as unknown as Socket;
        const service = new AutenticacionWsService(
            jwt as unknown as JwtService,
            prisma as unknown as PrismaService
        );
        // Act: autenticar la conexión.
        const usuario = await service.autenticar(socket);
        // Assert: validar firma/antigüedad y evitar confiar en un rol antiguo.
        expect(usuario.rol).toBe('RRHH');
        expect(jwt.verifyAsync).toHaveBeenCalledWith(
            'jwt-demo',
            expect.objectContaining({ algorithms: ['HS256'], maxAge: '15m' })
        );
    });

    it('Debe rechazar una conexión sin token antes de consultar la BD', async () => {
        // Arrange: navegador sin autorización.
        const jwt = { verifyAsync: jest.fn() };
        const prisma = { usuarios: { findUnique: jest.fn() } };
        const service = new AutenticacionWsService(
            jwt as unknown as JwtService,
            prisma as unknown as PrismaService
        );
        const socket = {
            handshake: { auth: {}, headers: {} },
        } as unknown as Socket;
        // Act: intentar autenticar.
        const resultado = service.autenticar(socket);
        // Assert: detener la operación en la frontera de autenticación.
        await expect(resultado).rejects.toThrow(UnauthorizedException);
        expect(prisma.usuarios.findUnique).not.toHaveBeenCalled();
    });

    it('Debe invalidar la suscripción si el usuario cambió de rol', async () => {
        // Arrange: el usuario ya no pertenece al rol de su sala.
        const prisma = {
            usuarios: {
                findUnique: jest
                    .fn()
                    .mockResolvedValue({
                        activo: true,
                        deleted_at: null,
                        rol: 'CONTADOR',
                    }),
            },
        };
        const service = new AutenticacionWsService(
            {} as JwtService,
            prisma as unknown as PrismaService
        );
        // Act: comprobar la pertenencia de la sesión anterior.
        const vigente = await service.sigueVigente('usuario-demo', 'RRHH');
        // Assert: no mantener acceso a las alertas del rol anterior.
        expect(vigente).toBe(false);
    });
});
