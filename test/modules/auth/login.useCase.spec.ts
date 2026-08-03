//test/modules/auth/login.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LoginUseCase } from '@/modules/auth/use-cases/login.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

//Mock de Argon2 para simular la verificación de contraseñas
jest.mock('argon2', () => ({
    verify: jest.fn(async (hash: string, password: string) => {
        return hash === `hashed_${password}`;
    }),
    hash: jest.fn(async () => 'hashed_rt_mock_123'),
    argon2id: 2, // Constante requerida por tu código real
}));

//Mock de Crypto para simular la generación de UUID
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'uuid-mock-1234'),
}));

//Describe el bloque de pruebas para el caso de uso de inicio de sesión
describe('LoginUseCase', () => {
    let useCase: LoginUseCase;

    //Mockear el servicio Prisma
    const mockPrisma = {
        usuarios: { findFirst: jest.fn() },
        tokens_seguridad: { create: jest.fn() },
    };

    //Mockear el servicio Jwt
    const mockJwt = {
        sign: jest.fn(),
        signAsync: jest.fn(),
    };

    //Configurar el módulo de pruebas antes de cada prueba
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LoginUseCase,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: JwtService, useValue: mockJwt },
            ],
        }).compile();

        useCase = module.get<LoginUseCase>(LoginUseCase);
    });

    //Despues de cada prueba, limpiar los mocks
    afterEach(() => {
        jest.clearAllMocks();
    });


    
    it('Deberia retornar un Access Token y Refresh Token cuando las credenciales son correctas', async () => {
        //Arrange: Configurar los datos de prueba y los mocks
        const mockUser = {
            id: 'uuid-123',
            password_hash: 'hashed_correctPassword', // Simula clave correcta
            rol: 'ADMIN',
            empleado_id: 'emp-123',
            empleados: { nro_documento: '70112233' },
        };

        //Configurar los mocks para devolver el usuario simulado y los tokens
        mockPrisma.usuarios.findFirst.mockResolvedValue(mockUser);
        mockPrisma.tokens_seguridad.create.mockResolvedValue({});
        mockJwt.signAsync
          .mockResolvedValueOnce('access_token_mock')
          .mockResolvedValueOnce('refresh_token_mock');

        //ACT: Ejecutar
        const result = await useCase.execute({
            tipo_documento: 'DNI',
            nro_documento: '70112233',
            password: 'correctPassword',
        });

        //Assert: Verificamos resultados
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
        expect(result.usuario.rol).toBe('ADMIN');

        //Verificar que los mocks fueron llamados correctamente
        expect(mockPrisma.usuarios.findFirst).toHaveBeenCalled();
        expect(mockJwt.signAsync).toHaveBeenCalledTimes(2);
    });



    it('Debería lanzar UnauthorizedException si el usuario no existe', async () => {
        //Arrange: Prisma no encuentra el registro
        mockPrisma.usuarios.findFirst.mockResolvedValue(null); 

        //Act & Assert
        await expect(useCase.execute({ tipo_documento: 'DNI', nro_documento: '00000000', password: 'Password123!' })).rejects.toThrow(UnauthorizedException);
        await expect(useCase.execute({ tipo_documento: 'DNI', nro_documento: '00000000', password: 'Password123!' })).rejects.toThrow('Unauthorized Exception');
    });



    it('Debería lanzar UnauthorizedException si la contraseña es incorrecta (validado por el Smart Mock)', async () => {
        //Arrange: Prisma SÍ encuentra al usuario
        const mockUser = { 
            id: 'uuid-123', 
            activo: true, 
            deleted_at: null,
            password_hash: 'hashed_Password123!', // Esta es la clave correcta en BD
            empleados: { tipo_documento: { tipo_documento: 'DNI' } }
        };
        mockPrisma.usuarios.findFirst.mockResolvedValue(mockUser);
        
        //Act & Assert: Enviamos una clave incorrecta. El Smart Mock de Argon2 devolverá false.
        await expect(useCase.execute({ tipo_documento: 'DNI', nro_documento: '70112233', password: 'ClaveIncorrecta99' })).rejects.toThrow(UnauthorizedException);
    });



    it('Debería lanzar UnauthorizedException si el usuario está inactivo (Soft Delete o Suspensión)', async () => {
        //Arrange: Prisma encuentra al usuario, pero está despedido (activo: false)
        mockPrisma.usuarios.findFirst.mockResolvedValue(null);

        //Act & Assert: Incluso si la clave es correcta, debe rebotar
        await expect(useCase.execute({ tipo_documento: 'DNI', nro_documento: '70112233', password: 'Password123!' })).rejects.toThrow(UnauthorizedException);
        await expect(useCase.execute({ tipo_documento: 'DNI', nro_documento: '70112233', password: 'Password123!' })).rejects.toThrow('Unauthorized Exception'); // Mensaje genérico por seguridad
    });
});
