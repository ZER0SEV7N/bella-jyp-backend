//test/modules/core/auth/auth.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException, HttpStatus } from '@nestjs/common';
import { AuthController } from '@/modules/core/auth/controller/auth.controller';
import { LoginUseCase } from '@/modules/core/auth/use-cases/login.useCase';
import { ProvisionarUsuarioUseCase } from '@/modules/core/auth/use-cases/provisionarUsuario.useCase';
import { RefrescarTokenUseCase } from '@/modules/core/auth/use-cases/refrescarToken.useCase';
import { RecuperacionPasswordUseCases } from '@/modules/core/auth/use-cases/recuperacionPassword.useCases';
import { LogoutUseCase } from '@/modules/core/auth/use-cases/logout.useCase';
import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Pruebas unitarias para el controlador AuthController, que maneja las operaciones de autenticación.
 * Estas pruebas verifican el comportamiento del controlador en escenarios de éxito y error.
 * Se simula la interacción con los casos de uso (UseCases) mediante mocks para evitar dependencias externas.
 * Se valida que los endpoints respondan correctamente según las reglas de negocio definidas.
 */
describe('AuthController - Pruebas Unitarias de Endpoints HTTP', () => {
  let controller: AuthController;

  //Mockear los casos de uso (UseCases) para simular su comportamiento
  const mockLoginUC = { execute: jest.fn() };
  const mockRefreshUC = { execute: jest.fn() };
  const mockProvisionarUC = { execute: jest.fn() };
  const mockRecuperacionUC = { solicitar: jest.fn() };
  const mockLogoutUC = { execute: jest.fn() };

  //Configuración del módulo de pruebas antes de cada test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: LoginUseCase, useValue: mockLoginUC },
        { provide: RefrescarTokenUseCase, useValue: mockRefreshUC },
        { provide: ProvisionarUsuarioUseCase, useValue: mockProvisionarUC },
        { provide: RecuperacionPasswordUseCases, useValue: mockRecuperacionUC },
        { provide: LogoutUseCase, useValue: mockLogoutUC }
      ]
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  //=========================================================================
  //POST /api/auth/login
  //=========================================================================
  describe('POST /api/auth/login - Iniciar Sesión', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe inyectar la cookie HTTP-Only con path general y devolver el Access Token junto a los datos del colaborador', async () => {
        //Arrange: Mockear la respuesta del caso de uso de login
        const mockRes = { setCookie: jest.fn() } as unknown as FastifyReply;
        const mockLoginResult = {
          accessToken: 'jwt-access-mock-token',
          refreshToken: 'jwt-refresh-mock-token',
          usuario: {
            id: 'user-uuid-1',
            nombre: 'Carlos Ramírez Silva',
            email: 'contador@jyp.com',
            nro_documento: '70112233',
            rol: 'CONTADOR'
          }
        };
        mockLoginUC.execute.mockResolvedValue(mockLoginResult);

        //Act: Llamar al endpoint de login con credenciales válidas
        const result = await controller.login( { tipo_documento: 'DNI', nro_documento: '70112233', password: 'Password123!' },mockRes);

        //Assert: Verificar que se haya llamado al caso de uso con los datos correctos y que la respuesta sea la esperada
        expect(result.accessToken).toBe('jwt-access-mock-token');
        expect(result.usuario.nombre).toBe('Carlos Ramírez Silva');
        expect(mockRes.setCookie).toHaveBeenCalledWith('jyp_rt', 'jwt-refresh-mock-token', expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60
        }));
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe propagar UnauthorizedException si las credenciales son incorrectas', async () => {
        //Arrange: Mockear el caso de uso para que lance UnauthorizedException
        mockLoginUC.execute.mockRejectedValue(new UnauthorizedException('El documento o la contraseña son incorrectos.'));

        //Act & Assert: Verificar que el endpoint lance la excepción esperada al intentar iniciar sesión con credenciales incorrectas
        await expect(controller.login(
          { tipo_documento: 'DNI', nro_documento: '70112233', password: 'ClaveIncorrecta!' },
          { setCookie: jest.fn() } as any,
        )).rejects.toThrow(UnauthorizedException);
      });
    });
  });

  //=========================================================================
  //POST /api/auth/refresh
  //=========================================================================
  describe('POST /api/auth/refresh - Renovar Access Token', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe extraer la cookie jyp_rt de la request y emitir un nuevo Access Token', async () => {
        //Arrange: Objeto request con cookie de Fastify
        const mockReq = { cookies: { jyp_rt: 'cookie-refresh-activa' } } as unknown as FastifyRequest;

        mockRefreshUC.execute.mockResolvedValue({ accessToken: 'new-jwt-access-token' });

        //Act: Llamar al endpoint de refresh token
        const result = await controller.refreshToken(mockReq, {} as any);

        //Assert: Verificar que se haya llamado al caso de uso con la cookie correcta y que el resultado sea el esperado
        expect(mockRefreshUC.execute).toHaveBeenCalledWith('cookie-refresh-activa');
        expect(result.accessToken).toBe('new-jwt-access-token');
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe lanzar UnauthorizedException si no existe la cookie en req.cookies', async () => {
        //Arrange: Objeto request sin cookie de Fastify
        const mockReq = { cookies: {} } as unknown as FastifyRequest;

        //Act & Assert: Verificar que el endpoint lance UnauthorizedException al no encontrar la cookie
        await expect(controller.refreshToken(mockReq, {} as any)).rejects.toThrow(UnauthorizedException);
        expect(mockRefreshUC.execute).not.toHaveBeenCalled();
      });
    });
  });

  //=========================================================================
  //POST /api/auth/logout
  //=========================================================================
  describe('POST /api/auth/logout - Cerrar Sesión', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe delegar la invalidación de tokens y eliminar la cookie estableciendo maxAge=0', async () => {
        //Arrange: Crear un request simulado con cookie y cabecera Authorization
        const mockReq = {cookies: { jyp_rt: 'refresh-token-a-invalidar' }, headers: { authorization: 'Bearer access-token-a-bloquear' }} as unknown as FastifyRequest;

        //Mockear la respuesta del caso de uso de logout
        const mockRes = { setCookie: jest.fn() } as unknown as FastifyReply;
        mockLogoutUC.execute.mockResolvedValue(undefined);

        //Act: Llamar al endpoint de logout
        const result = await controller.logout(mockReq, mockRes);

        //Assert: Verificar que se haya llamado al caso de uso con los tokens correctos y que la cookie se haya eliminado correctamente
        expect(mockLogoutUC.execute).toHaveBeenCalledWith( 'refresh-token-a-invalidar', 'access-token-a-bloquear' );
        expect(mockRes.setCookie).toHaveBeenCalledWith( 'jyp_rt', '', expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 0
        }));
        expect(result.title).toBe('Sesión Finalizada');
      });

      it('Debe procesar el logout incluso si no se envía la cabecera Authorization (solo con cookie)', async () => {
        //Arrange: Crear un request simulado con solo la cookie de refresh token
        const mockReq = {cookies: { jyp_rt: 'refresh-token-solo' }, headers: {} } as unknown as FastifyRequest;

        //Mockear la respuesta del caso de uso de logout
        const mockRes = { setCookie: jest.fn() } as unknown as FastifyReply;

        //Act: Llamar al endpoint de logout
        await controller.logout(mockReq, mockRes);

        //Assert: Verificar que se haya llamado al caso de uso con el refresh token y que la cookie se haya eliminado correctamente
        expect(mockLogoutUC.execute).toHaveBeenCalledWith('refresh-token-solo', undefined);
        expect(mockRes.setCookie).toHaveBeenCalledWith('jyp_rt', '', expect.objectContaining({ maxAge: 0 }));
      });
    });
  });

  //=========================================================================
  //POST /api/auth/provisionar
  //=========================================================================
  describe('POST /api/auth/provisionar - Crear Usuario', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe crear un usuario y devolver el registro', async () => {
        //Arrange: Crear un payload de ejemplo para provisionar un usuario
        const payload = {
          tipo_documento: 'DNI',
          nro_documento: '70223344',
          password: 'Password123!',
          rol: 'RRHH'
        } as any;

        //Mockear la respuesta del caso de uso de provisionar usuario
        mockProvisionarUC.execute.mockResolvedValue({ id: 'user-uuid-rrhh', rol: 'RRHH' });

        //Act: Llamar al endpoint de provisionar usuario
        const result = await controller.provisionar(payload);

        //Assert: Verificar que se haya llamado al caso de uso con el payload correcto y que la respuesta sea la esperada
        expect(result.rol).toBe('RRHH');
        expect(mockProvisionarUC.execute).toHaveBeenCalledWith(payload);
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe relanzar BadRequestException si el usuario ya existe', async () => {
        //Arrange: Mockear el caso de uso para que lance BadRequestException al intentar crear un usuario duplicado
        mockProvisionarUC.execute.mockRejectedValue(new BadRequestException('Usuario duplicado'));

        //Act & Assert: Verificar que el endpoint lance BadRequestException al intentar provisionar un usuario duplicado
        await expect(controller.provisionar({} as any)).rejects.toThrow(BadRequestException);
      });
    });
  });

  //=========================================================================
  //POST /api/auth/recuperar-password
  //=========================================================================
  describe('POST /api/auth/recuperar-password', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe procesar la solicitud de recuperación de contraseña', async () => {
        //Arrange: Crear un payload de ejemplo para solicitar la recuperación de contraseña
        const payload = { nro_documento: '70112233' };
        mockRecuperacionUC.solicitar.mockResolvedValue({ message: 'Correo enviado' });

        //Act: Llamar al endpoint de solicitud de recuperación de contraseña
        const result = await controller.solicitarRecuperacion(payload);

        //Assert: Verificar que se haya llamado al caso de uso con el payload correcto y que la respuesta sea la esperada
        expect(result.message).toBe('Correo enviado');
        expect(mockRecuperacionUC.solicitar).toHaveBeenCalledWith(payload);
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe lanzar BadRequestException si el colaborador no existe', async () => {
        //Arrange: Mockear el caso de uso para que lance BadRequestException al no encontrar el usuario
        mockRecuperacionUC.solicitar.mockRejectedValue(new BadRequestException('Usuario no encontrado'));

        //Act & Assert: Verificar que el endpoint lance BadRequestException al intentar solicitar recuperación para un usuario inexistente
        await expect(controller.solicitarRecuperacion({ nro_documento: '00000000' })).rejects.toThrow(BadRequestException);
      });
    });
  });
});