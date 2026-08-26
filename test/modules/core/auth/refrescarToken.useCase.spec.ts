//test/modules/auth/refrescarToken.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { RefrescarTokenUseCase } from '@/modules/core/auth/use-cases/refrescarToken.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

//Prueba unitaria para el caso de uso de refrescar token
describe('RefrescarTokenUseCase', () => {
  let useCase: RefrescarTokenUseCase;
  let mockPrisma: any;
  let mockJwt: any;

  beforeEach(async () => {
    //Mockear el servicio Prisma
    mockPrisma = { usuarios: { findUnique: jest.fn() } };
    //Mockear el servicio Jwt
    mockJwt = {
      sign: jest.fn(),
      signAsync: jest.fn(),
      verify: jest.fn(),
      verifyAsync: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefrescarTokenUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt }
      ]
    }).compile();

    useCase = module.get<RefrescarTokenUseCase>(RefrescarTokenUseCase);
  });

  //Limpieza de mocks después de cada prueba
  afterEach(() => jest.clearAllMocks());

  it('Deberia retornar un nuevo Access Token si el Refresh Token es valido y el usuario este activo', async () => {
    //Arrange: Configurar los datos de prueba y los mocks
    const payload = { sub: 'user-123', rol: 'ADMIN' };
    mockJwt.verify.mockReturnValue(payload);
    mockJwt.verifyAsync.mockResolvedValue(payload);
    mockPrisma.usuarios.findUnique.mockResolvedValue({
      id: 'user-123',
      activo: true,
      deleted_at: null
    });

    //loguear el mock de signAsync para retornar un nuevo token
    mockJwt.sign.mockReturnValue('new-access-token');
    mockJwt.signAsync.mockResolvedValue('new-access-token');
    mockPrisma.usuarios.findUnique.mockResolvedValue({
      id: 'user-123',
      activo: true,
      deleted_at: null
    });

    //Act: Ejecutar el caso de uso
    const result = await useCase.execute('valid-refresh-token');

    //Assert: Verificar que el resultado sea el esperado
    expect(result.accessToken).toBe('new-access-token');
    expect(mockPrisma.usuarios.findUnique).toHaveBeenCalledWith({where: { id: 'user-123' }});
  });

  it('Deberia lanzar error si el Refresh Token esta expirado o fue manipulado', async () => {
    //Arrange: Configurar el mock para simular un token inválido
    mockJwt.verify.mockImplementation(() => {throw new Error('jwt expired');});
    mockJwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    //Act & Assert: Ejecutar el caso de uso y verificar que lance la excepción esperada
    await expect(useCase.execute('expired_token')).rejects.toThrow(UnauthorizedException);
    await expect(useCase.execute('expired_token')).rejects.toThrow('Refresh token inválido o expirado.');
  });

  it('Deberia bloquear el refresh si el usuario fue desactivado en la BD mientras el Refresh Token sigue siendo valido', async () => {
    //Arrange: Configurar los mocks para simular un usuario desactivado
    const payload = { sub: 'user-123' };
    mockJwt.verify.mockReturnValue(payload);
    mockJwt.verifyAsync.mockResolvedValue(payload);
    mockPrisma.usuarios.findUnique.mockResolvedValue({
      id: 'user-123',
      activo: false,
      deleted_at: new Date()
    });

    //Act & Assert: Ejecutar el caso de uso y verificar que lance la excepción esperada
    await expect(useCase.execute('valid_token_but_fired_user')).rejects.toThrow(UnauthorizedException);
    await expect(useCase.execute('valid_token_but_fired_user')).rejects.toThrow('Usuario no encontrado o inactivo.');
  });
});
