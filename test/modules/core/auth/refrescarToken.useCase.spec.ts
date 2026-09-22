import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { RefrescarTokenUseCase } from '@/modules/core/auth/use-cases/refrescarToken.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

jest.mock('argon2', () => ({
  argon2id: 2,
  hash: jest.fn().mockResolvedValue('$argon2id$mocked-hash'),
}));

describe('RefrescarTokenUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: RefrescarTokenUseCase;
  let mockPrisma: any;
  let mockJwt: any;

  beforeEach(async () => {
    mockPrisma = {
      usuarios: {
        findUnique: jest.fn(),
      },
      tokens_seguridad: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => {
        if (typeof cb === 'function') return await cb(mockPrisma);
        return Promise.all(cb);
      }),
    };

    mockJwt = {
      sign: jest.fn(),
      signAsync: jest.fn(),
      verify: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefrescarTokenUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    useCase = module.get<RefrescarTokenUseCase>(RefrescarTokenUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  describe('Casos de Éxito (Happy Path)', () => {
    it('Debe emitir un nuevo Access Token y rotar el Refresh Token si la sesión es válida', async () => {
      // Arrange
      const payloadJwt = {
        sub: 'user-uuid-1',
        rol: 'ADMIN',
        doc: '70000001',
      };
      mockJwt.verify.mockReturnValue(payloadJwt);

      mockPrisma.usuarios.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'admin@jyp.com',
        rol: 'ADMIN',
        empleado_id: 'emp-uuid-1',
        activo: true,
        deleted_at: null,
        empleados: {
          nombre: 'Administrador',
          apellido: 'Sistema Central',
          nro_documento: '70000001',
        },
      });

      mockPrisma.tokens_seguridad.findFirst.mockResolvedValue({
        id: 'token-uuid-1',
        usuario_id: 'user-uuid-1',
        usado: false,
        expira_en: new Date(Date.now() + 100000),
      });

      mockJwt.signAsync
        .mockResolvedValueOnce('new-access-token-15m')
        .mockResolvedValueOnce('new-refresh-token-7d');

      mockPrisma.tokens_seguridad.update.mockResolvedValue({ id: 'token-uuid-1', usado: true });
      mockPrisma.tokens_seguridad.create.mockResolvedValue({ id: 'token-uuid-2', usado: false });

      // Act
      const result = await useCase.execute('valid-refresh-token');

      // Assert
      expect(result.accessToken).toBe('new-access-token-15m');
      expect(result.newRefreshToken).toBe('new-refresh-token-7d');

      expect(mockJwt.verify).toHaveBeenCalledWith('valid-refresh-token', expect.any(Object));
      expect(mockPrisma.usuarios.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        include: {
          empleados: {
            select: {
              nombre: true,
              apellido: true,
              nro_documento: true,
            },
          },
        },
      });
      expect(mockPrisma.tokens_seguridad.findFirst).toHaveBeenCalledWith({
        where: {
          usuario_id: 'user-uuid-1',
          proposito: 'REFRESH_TOKEN',
          usado: false,
          expira_en: { gt: expect.any(Date) },
        },
      });

      // Valida la transacción atómica de rotación
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.tokens_seguridad.update).toHaveBeenCalledWith({
        where: { id: 'token-uuid-1' },
        data: { usado: true },
      });
      expect(mockPrisma.tokens_seguridad.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuario_id: 'user-uuid-1',
          proposito: 'REFRESH_TOKEN',
          usado: false,
        }),
      });
    });
  });

  describe('Validaciones de Negocio y Excepciones', () => {
    it('Debe lanzar UnauthorizedException si no se provee un token', async () => {
      // Act & Assert
      await expect(useCase.execute('')).rejects.toThrow(
        new UnauthorizedException('Refresh token no proporcionado.'),
      );
    });

    it('Debe lanzar UnauthorizedException si la firma criptográfica es inválida o expiró', async () => {
      // Arrange
      mockJwt.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      // Act & Assert
      await expect(useCase.execute('token-manipulado')).rejects.toThrow(
        new UnauthorizedException('Refresh token inválido o expirado.'),
      );
    });

    it('Debe lanzar UnauthorizedException si el usuario asociado fue dado de baja', async () => {
      // Arrange
      mockJwt.verify.mockReturnValue({ sub: 'user-uuid-1' });
      mockPrisma.usuarios.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        activo: false,
        deleted_at: new Date(),
      });

      // Act & Assert
      await expect(useCase.execute('token-valido-usuario-inactivo')).rejects.toThrow(
        new UnauthorizedException('Usuario no encontrado o inactivo.'),
      );
    });

    it('Debe lanzar UnauthorizedException si el token ya fue revocado en tokens_seguridad (sesión cerrada)', async () => {
      // Arrange
      mockJwt.verify.mockReturnValue({ sub: 'user-uuid-1' });
      mockPrisma.usuarios.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        activo: true,
        deleted_at: null,
        empleados: { nombre: 'Carlos', apellido: 'Ramírez' },
      });
      mockPrisma.tokens_seguridad.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute('token-revocado')).rejects.toThrow(
        new UnauthorizedException('Sesión cerrada o token revocado.'),
      );
    });
  });
});