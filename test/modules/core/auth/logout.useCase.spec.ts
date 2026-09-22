//test/modules/core/auth/logout.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { LogoutUseCase } from '@/modules/core/auth/use-cases/logout.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { REDIS_CLIENT } from '@/common/cls/redis.constants';

/**
 * Pruebas unitarias para el caso de uso de cierre de sesión (LogoutUseCase).
 * Se simula el comportamiento de las dependencias externas (PrismaService, JwtService y Redis) 
 * para verificar que el caso de uso maneja correctamente la lógica de invalidación de tokens.
 * Se incluyen pruebas para los escenarios de éxito, así como validaciones de negocio y tolerancia a fallos.
 */
describe('LogoutUseCase - Pruebas Unitarias de Cierre de Sesión', () => {
  //Variables compartidas para las pruebas
  let useCase: LogoutUseCase;
  let mockPrisma: any;
  let mockJwt: any;
  let mockRedis: any;

  //Configuración del módulo de pruebas antes de cada test
  beforeEach(async () => {
    mockPrisma = { tokens_seguridad: { updateMany: jest.fn() } };
    mockJwt = { decode: jest.fn() };
    mockRedis = { set: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogoutUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: REDIS_CLIENT, useValue: mockRedis }
      ]
    }).compile();

    useCase = module.get<LogoutUseCase>(LogoutUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  describe('Casos de Éxito (Happy Path)', () => {
    it('Debe invalidar tokens_seguridad en PostgreSQL y añadir el Access Token a la lista negra de Redis', async () => {
      //Arrange: Mockear la decodificación de los tokens y la respuesta de Prisma y Redis
      const refreshToken = 'sample-refresh-token';
      const accessToken = 'sample-access-token';

      //Simular la decodificación de los tokens para obtener el ID del usuario y el tiempo de expiración
      mockJwt.decode.mockImplementation((token: string) => {
        if (token === refreshToken) 
          return { sub: 'user-uuid-1' };
        
        //Simular la decodificación del Access Token para obtener el tiempo de expiración
        if (token === accessToken) {
          const ahoraSegundos = Math.floor(Date.now() / 1000);
          return { sub: 'user-uuid-1', exp: ahoraSegundos + 600 }; //10 minutos restantes (600s)
        }
        return null;
      });

      //Simular la actualización de tokens_seguridad en PostgreSQL
      mockPrisma.tokens_seguridad.updateMany.mockResolvedValue({ count: 1 });
      mockRedis.set.mockResolvedValue('OK');

      //Act: Ejecutar el caso de uso de cierre de sesión
      await useCase.execute(refreshToken, accessToken);

      //Assert: Verificar que se haya llamado a Prisma y Redis con los parámetros correctos
      expect(mockPrisma.tokens_seguridad.updateMany).toHaveBeenCalledWith({
        where: {
          usuario_id: 'user-uuid-1',
          proposito: 'REFRESH_TOKEN',
          usado: false
        },
        data: { usado: true }
      });

      //Verificar que se haya llamado a Redis para añadir el Access Token a la lista negra con el tiempo de expiración correcto
      expect(mockRedis.set).toHaveBeenCalledWith(
        `blacklist:jwt:${accessToken}`,
        'revoked',
        'EX',
        expect.any(Number)
      );
    });

    it('Debe procesar la invalidación únicamente en PostgreSQL si no se proporciona Access Token', async () => {
      //Arrange: Mockear la decodificación del Refresh Token y la respuesta de Prisma
      const refreshToken = 'sample-refresh-token';
      mockJwt.decode.mockReturnValue({ sub: 'user-uuid-1' });
      mockPrisma.tokens_seguridad.updateMany.mockResolvedValue({ count: 1 });

      //Act: Ejecutar el caso de uso de cierre de sesión solo con Refresh Token
      await useCase.execute(refreshToken, undefined);

      //Assert: Verificar que se haya llamado a Prisma para invalidar el Refresh Token y que Redis no haya sido llamado
      expect(mockPrisma.tokens_seguridad.updateMany).toHaveBeenCalledWith({
        where: {
          usuario_id: 'user-uuid-1',
          proposito: 'REFRESH_TOKEN',
          usado: false
        },
        data: { usado: true }
      });
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('Debe agregar el Access Token a Redis sin alterar BD si no se envía Refresh Token', async () => {
      //Arrange: Mockear la decodificación del Access Token y la respuesta de Redis
      const accessToken = 'sample-access-token';
      const ahoraSegundos = Math.floor(Date.now() / 1000);

      mockJwt.decode.mockReturnValue({ sub: 'user-uuid-1', exp: ahoraSegundos + 300 });
      mockRedis.set.mockResolvedValue('OK');

      //Act: Ejecutar el caso de uso de cierre de sesión solo con Access Token
      await useCase.execute(undefined, accessToken);

      //Assert: Verificar que Redis haya sido llamado para añadir el Access Token a la lista negra y que Prisma no haya sido llamado
      expect(mockPrisma.tokens_seguridad.updateMany).not.toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith(
        `blacklist:jwt:${accessToken}`,
        'revoked',
        'EX',
        expect.any(Number)
      );
    });

    it('No debe llamar a Redis si el Access Token ya había expirado (ttl <= 0)', async () => {
      //Arrange: Mockear la decodificación del Access Token para simular que ya expiró
      const accessToken = 'expired-access-token';
      const ahoraSegundos = Math.floor(Date.now() / 1000);

      mockJwt.decode.mockReturnValue({ exp: ahoraSegundos - 100 });

      //Act: Ejecutar el caso de uso de cierre de sesión con un Access Token expirado
      await useCase.execute(undefined, accessToken);

      //Assert: Verificar que Redis no haya sido llamado ya que el token expiró
      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe('Validaciones de Negocio y Tolerancia a Fallos', () => {
    it('Debe ejecutarse sin lanzar excepciones si los tokens son strings malformados', async () => {
      //Arrange: Mockear la decodificación de tokens para que devuelva null (malformados)
      mockJwt.decode.mockReturnValue(null);

      //Act & Assert: Ejecutar el caso de uso con tokens malformados y verificar que no lance excepciones
      await expect(useCase.execute('token-invalido', 'token-invalido')).resolves.toBeUndefined();
      expect(mockPrisma.tokens_seguridad.updateMany).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });
});