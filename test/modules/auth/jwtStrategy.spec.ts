//test/modules/auth/jwtStrategy.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ClsService } from 'nestjs-cls';

//Prueba unitaria para la estrategia JWT
describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockPrisma: any;
  let mockCls: any;

  //Configuración del módulo de pruebas antes de cada prueba
  beforeEach(async () => {
    mockPrisma = { usuarios: { findUnique: jest.fn() } };
    mockCls = { set: jest.fn() };

    //Setear variables de entorno necesarias para la estrategia JWT
    process.env.JWT_ACCESS_SECRET = 'test-secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClsService, useValue: mockCls },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  //Limpieza de mocks después de cada prueba
  afterEach(() => jest.clearAllMocks());

  it('Deberia validar el payload, verificar la BD e inyectar el CLS context', async () => {
    //Arrange: Configurar el payload de prueba y el mock de la base de datos
    const mockPayload = { sub: 'user-123' };
    const mockReq = { ip: '192.168.1.1' };
    const mockUser = {
      id: 'user-123',
      rol: 'ADMIN',
      empleado_id: 'emp-123',
      activo: true,
      deleted_at: null,
    };

    mockPrisma.usuarios.findUnique.mockResolvedValue(mockUser);

    //Act: Ejecutar la función validate de la estrategia JWT
    const result = await strategy.validate(mockReq, mockPayload);

    //Assert: Verificar que el resultado sea el esperado y que los mocks hayan sido llamados correctamente
    expect(result).toEqual({
      id: 'user-123',
      rol: 'ADMIN',
      empleado_id: 'emp-123',
    });
    expect(mockCls.set).toHaveBeenCalledWith('CLS_USER_ID', 'user-123');
    expect(mockCls.set).toHaveBeenCalledWith('CLS_IP_ADDRESS', '192.168.1.1');
  });

  it('Deberia lanzar UnauthorizedException si el payload es inválido o no tiene "sub"', async () => {
    //Arrange: Configurar un payload inválido (sin 'sub') y un mock de la base de datos
    const mockPayload = { email: 'hacker@malicioso.com' }; //Falta el 'sub' (ID)

    //Act & Assert: Ejecutar la función validate de la estrategia JWT y verificar que lance la excepción esperada
    //El validador debe rechazarlo incluso antes de tocar la base de datos
    await expect(strategy.validate({}, mockPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('Deberia lanzar UnauthorizedException si el usuario no existe o esta inactivo', async () => {
    //Arrange: Configurar el payload de prueba y el mock de la base de datos
    const mockPayload = { sub: 'user-404' };
    mockPrisma.usuarios.findUnique.mockResolvedValue(null);

    //Act: Ejecutar la función validate de la estrategia JWT
    await expect(strategy.validate({}, mockPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('Deberia lanzar UnauthorizedException si el usuario existe pero está inactivo (activo: false)', async () => {
    //Arrange: Configurar el payload de prueba y el mock de la base de datos
    const mockPayload = { sub: 'user-123' };
    mockPrisma.usuarios.findUnique.mockResolvedValue({
      id: 'user-123',
      activo: false,
      deleted_at: new Date(),
    });

    //Act & Assert: Ejecutar la función validate de la estrategia JWT y verificar que lance la excepción esperada
    await expect(strategy.validate({}, mockPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
