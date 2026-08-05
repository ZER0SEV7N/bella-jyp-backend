//test/modules/auth/auth.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from '@/modules/auth/controller/auth.controller';
import { LoginUseCase } from '@/modules/auth/use-cases/login.useCase';
import { ProvisionarUsuarioUseCase } from '@/modules/auth/use-cases/provisionarUsuario.useCase';
import { RefrescarTokenUseCase } from '@/modules/auth/use-cases/refrescarToken.useCase';
import { RecuperacionPasswordUseCases } from '@/modules/auth/use-cases/recuperacionPassword.useCases';

describe('AuthController', () => {
    let controller: AuthController;
    //Mocks de los casos de uso que el controlador utiliza
    const mockLoginUC = { execute: jest.fn() };
    const mockRefreshUC = { execute: jest.fn() };
    const mockProvisionarUC = { execute: jest.fn() };
    const mockRecuperacionUC = { solicitar: jest.fn() };

    //Configuración del módulo de pruebas antes de cada prueba
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                { provide: LoginUseCase, useValue: mockLoginUC },
                { provide: RefrescarTokenUseCase, useValue: mockRefreshUC },
                { provide: ProvisionarUsuarioUseCase, useValue: mockProvisionarUC },
                { provide: RecuperacionPasswordUseCases, useValue: mockRecuperacionUC }, //Mock vacío para este caso de uso
            ],
        }).compile();
        
        controller = module.get<AuthController>(AuthController);
    });

    //Limpieza de mocks después de cada prueba
    afterEach(() => jest.clearAllMocks());


    //=========================================================================
    //ENDPOINT: LOGIN
    //=========================================================================
    it('Login: Deberia inyectar la cookie HTTP-Only y retornar los datos', async () => {
        //Arrange: Configurar los datos de prueba y el mock del caso de uso
        const mockRes = { setCookie: jest.fn() } as any;
        mockLoginUC.execute.mockResolvedValue({
            accessToken: 'access-mock',
            refreshToken: 'refresh_mock',
            usuario: { id: 'user-123', rol: 'ADMIN' },
        });

        //Act: Ejecutar el método login del controlador
        const result = await controller.login({ tipo_documento: 'DNI', nro_documento: '70', password: '123'}, mockRes);

        //Assert: Verificar que el resultado sea el esperado y que los mocks hayan sido llamados correctamente
        expect(result.accessToken).toBe('access-mock');
        expect(mockRes.setCookie).toHaveBeenCalledWith(
            'jyp_rt',
            'refresh_mock',
            expect.objectContaining({ httpOnly: true, sameSite: 'strict' })
        );
    });


    it('Login: Deberia lanzar UnauthorizedException si las credenciales son incorrectas', async () => {
        //Arrange: Configurar el mock del caso de uso para lanzar una excepción
        mockLoginUC.execute.mockRejectedValue(new UnauthorizedException('Credenciales incorrectas'));

        //Act & Assert: Ejecutar el método login y verificar que lance la excepción esperada
        await expect(controller.login({ tipo_documento: 'DNI', nro_documento: '70', password: 'wrong'}, {} as any)).rejects.toThrow(UnauthorizedException);
    });

    //=========================================================================
    //ENDPOINT: REFRESH
    //=========================================================================
    it('Refresh: Deberia procesar la cookie enviada por Fastify y retornar un nuevo Access Token', async () => {
        //Arrange: Configurar los datos de prueba y el mock del caso de uso
        const mockRes = { 
            cookies: { jyp_rt: 'valid_cookie_token'}, 
            request: { headers: {} } 
        } as any;
        mockRefreshUC.execute.mockResolvedValue({ accessToken: 'new-access' });

        //Act: Ejecutar el método refresh del controlador
        const result = await controller.refreshToken(mockRes);

        //Assert: Verificar que el resultado sea el esperado y que los mocks hayan sido llamados correctamente
        expect(result.accessToken).toBe('new-access');
        expect(mockRefreshUC.execute).toHaveBeenCalledWith('valid_cookie_token');
    });


    it('Refresh: Debería usar el Fallback leyendo headers.cookie si req.cookies es undefined', async () => {
        //Arrange:
        const mockRes = {
            cookies: undefined,
            request: { headers: { cookie: 'jyp_rt=fallback_token; otra=cookie' } },
        } as any;
        mockRefreshUC.execute.mockResolvedValue({ accessToken: 'new_access_from_fallback' });

        //Act:
        const result = await controller.refreshToken(mockRes);

        //Assert:
        expect(mockRefreshUC.execute).toHaveBeenCalledWith('fallback_token');
        expect(result.accessToken).toBe('new_access_from_fallback');
    });

    
    it('Refresh: Deberia lanzar UnauthorizedException si no se encuentra la cookie ni en req.cookies ni en headers.cookie', async () => {
        //Arrange: Configurar el request sin cookies
        const mockRes = { cookies: undefined, request: { headers: {} } } as any;

        //Act & Assert: Ejecutar el método refresh y verificar que lance la excepción esperada
        await expect(controller.refreshToken(mockRes)).rejects.toThrow(UnauthorizedException);
        await expect(controller.refreshToken(mockRes)).rejects.toThrow('No se encontró el Refresh Token en las cookies o ha expirado.');
    });

    //=========================================================================
    //ENDPOINT: PROVISIONAR
    //=========================================================================
    it('Provisionar: Debería crear un usuario exitosamente', async () => {
        //Arrange: Configurar los datos de prueba y el mock del caso de uso
        const payload = { tipo_documento: 'DNI', nro_documento: '123', password: 'pass', rol: 'ADMIN' } as any;
        mockProvisionarUC.execute.mockResolvedValue({ id: 'user-123', rol: 'ADMIN' });

        //Act: Ejecutar el método provisionar del controlador
        const result = await controller.provisionar(payload);

        //Assert: Verificar que el resultado sea el esperado y que los mocks hayan sido llamados correctamente
        expect(result.rol).toBe('ADMIN');
        expect(mockProvisionarUC.execute).toHaveBeenCalledWith(payload);
    });

    it('Provisionar: Debería relanzar error si el caso de uso falla (Ej. Usuario duplicado)', async () => {
        //Arrange: Configurar el mock del caso de uso para lanzar una excepción
        mockProvisionarUC.execute.mockRejectedValue(new BadRequestException('Usuario duplicado'));
        //Act & Assert: Ejecutar el método provisionar y verificar que lance la excepción esperada
        await expect(controller.provisionar({} as any)).rejects.toThrow(BadRequestException);
    });

    //=========================================================================
    //ENDPOINT: RECUPERAR PASSWORD
    //=========================================================================
    it('Recuperar Password: Debería procesar la solicitud exitosamente', async () => {
        //Arrange: Configurar los datos de prueba y el mock del caso de uso
        const payload = { nro_documento: '70112233' };
        mockRecuperacionUC.solicitar.mockResolvedValue({ message: 'Correo enviado' });

        //Act: Ejecutar el método solicitarRecuperacion del controlador
        const result = await controller.solicitarRecuperacion(payload);

        //Assert: Verificar que el resultado sea el esperado y que los mocks hayan sido llamados correctamente
        expect(result.message).toBe('Correo enviado');
        expect(mockRecuperacionUC.solicitar).toHaveBeenCalledWith(payload);
    });

    it('Recuperar Password: Debería lanzar error si el usuario no existe', async () => {
        //Arrange: Configurar el mock del caso de uso para lanzar una excepción
        mockRecuperacionUC.solicitar.mockRejectedValue(new BadRequestException('Usuario no encontrado'));

        //Act & Assert: Ejecutar el método solicitarRecuperacion y verificar que lance la excepción esperada
        await expect(controller.solicitarRecuperacion({ nro_documento: '70112233' })).rejects.toThrow(BadRequestException);
    });
});
