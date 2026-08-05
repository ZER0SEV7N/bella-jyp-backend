//test/modules/auth/recuperacionPassword.useCase.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RecuperacionPasswordUseCases } from '@/modules/auth/use-cases/recuperacionPassword.useCases';
import { PrismaService } from '@/common/prisma/prisma.service';
import axios from 'axios';

//Mock de Axios para simular las llamadas HTTP al webhook de n8n
jest.mock('axios');

//Mock de Argon2 para simular el hash y la verificación de tokens
jest.mock('argon2', () => ({
    hash: jest.fn(async () => 'hashed_mock_value'),
    verify: jest.fn(async (hash, plain) => plain === 'token_correcto_mock'),
    argon2id: 2,
}));

//Mock de Crypto para simular la generación de bytes aleatorios y UUIDs
jest.mock('crypto', () => ({
    randomBytes: jest.fn(() => Buffer.from('mocked-bytes')),
    randomUUID: jest.fn(() => 'uuid-1234'),
    createHmac: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
        digest: jest.fn().mockReturnValue('mocked-signature'),
        }),
    }),
}));

//Pruebas unitarias para el caso de uso de recuperación de contraseña
describe('RecuperacionPasswordUseCases', () => {
    let useCase: RecuperacionPasswordUseCases;
    let mockPrisma: any;

    //Configuración inicial antes de cada prueba
    beforeEach(async () => {
        mockPrisma = {
            usuarios: { findFirst: jest.fn(), update: jest.fn() },
            tokens_seguridad: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
            $transaction: jest.fn(async (queries) => Promise.all(queries)), // Simula la ejecución de la transacción
        };

        //Configuración de la variable de entorno para el webhook de n8n
        process.env.N8N_WEBHOOK_URL_RESET_PASSWORD = 'http://n8n-mock.com/webhook';

        //Creación del módulo de prueba con el caso de uso y el servicio de Prisma mockeado
        const module: TestingModule = await Test.createTestingModule({
        providers: [
            RecuperacionPasswordUseCases,
            { provide: PrismaService, useValue: mockPrisma },
        ],
        }).compile();

        useCase = module.get<RecuperacionPasswordUseCases>(RecuperacionPasswordUseCases);
    });

    //Limpiar los mocks después de cada prueba
    afterEach(() => {
        jest.clearAllMocks();
    });

    //=========================================================================
    //MÉTODO: SOLICITAR
    //=========================================================================
    describe('solicitar()', () => {
        it('Debería retornar un mensaje genérico si el usuario no existe (Prevención de Enumeración)', async () => {
            //Arrange: Simular que no existe un usuario con el documento proporcionado
            mockPrisma.usuarios.findFirst.mockResolvedValue(null);

            //Act: Ejecutar el método solicitar con un documento que no existe
            const result = await useCase.solicitar({ nro_documento: '0000' });

            //Assert: Verificar que se retorne el mensaje genérico y que no se haya intentado crear un token
            expect(result.message).toBe('Si el documento es válido, se enviarán las instrucciones.');
            expect(mockPrisma.tokens_seguridad.create).not.toHaveBeenCalled(); // Verifica que no se guarde nada
        });


        it('Debería lanzar BadRequestException si el usuario existe pero no tiene email', async () => {
            //Arrange: Simular que existe un usuario con el documento proporcionado pero sin email
            mockPrisma.usuarios.findFirst.mockResolvedValue({ id: 'user-1', email: null });

            //Act & Assert: Ejecutar el método solicitar y esperar que lance BadRequestException
            await expect(useCase.solicitar({ nro_documento: '7011' })).rejects.toThrow(BadRequestException);
        });

        it('Debería crear el token, disparar el webhook y retornar el mensaje de éxito (Happy Path)', async () => {
            //Arrange: Simular que existe un usuario con el documento proporcionado y con email
            mockPrisma.usuarios.findFirst.mockResolvedValue({ id: 'user-1', email: 'test@jyp.com' });
            mockPrisma.tokens_seguridad.create.mockResolvedValue({ id: 'token-uuid-1' });
            (axios.post as jest.Mock).mockResolvedValue({}); //Simular que el webhook de n8n responde correctamente

            //Act: Ejecutar el método solicitar con un documento válido
            const result = await useCase.solicitar({ nro_documento: '7011' });

            //Assert: Verificar que se retorne el mensaje genérico, que se haya creado el token y que se haya disparado el webhook
            expect(result.message).toBe('Si el documento es válido, se enviarán las instrucciones.');
            expect(mockPrisma.tokens_seguridad.create).toHaveBeenCalled();
            expect(axios.post).toHaveBeenCalled(); //Verifica que se haya disparado el webhook a n8n
        });
    });

    //=========================================================================
    //MÉTODO: RESTABLECER
    //=========================================================================
    describe('restablecer()', () => {
        //Payload de prueba para restablecer la contraseña
        const payload = { token_compuesto: 'tokenId.token_correcto_mock', nueva_password: 'newPass123!' };

        it('Debería actualizar la contraseña si el token es válido y no está expirado', async () => {
            //Arrange: Simular que el token existe, no ha sido usado, es del propósito correcto y no está expirado
            const mockTokenRecord = {
                id: 'tokenId',
                usuario_id: 'user-1',
                token_hash: 'hashed_mock',
                usado: false,
                proposito: 'RESET_PASSWORD',
                expira_en: new Date(Date.now() + 10000), // Vence en el futuro
            };
            mockPrisma.tokens_seguridad.findUnique.mockResolvedValue(mockTokenRecord);

            //Act: Ejecutar el método restablecer con el payload válido
            const result = await useCase.restablecer(payload);

            //Assert: Verificar que se retorne el mensaje de éxito y que se hayan ejecutado las actualizaciones en la transacción
            expect(result.message).toBe('Contraseña actualizada correctamente.');
            expect(mockPrisma.$transaction).toHaveBeenCalled(); // Verifica que se ejecutaron los Updates
        });

        it('Debería lanzar error si el token no existe, ya fue usado, o el propósito es incorrecto', async () => {
            //Caso: Token no existe
            //Arrange: Simular que no existe un token con el ID proporcionado
            mockPrisma.tokens_seguridad.findUnique.mockResolvedValue({ usado: true, proposito: 'RESET_PASSWORD' });
            //Act & Assert: Ejecutar el método restablecer y esperar que lance BadRequestException
            await expect(useCase.restablecer(payload)).rejects.toThrow(BadRequestException);

            //Caso: Propósito incorrecto (Ej. intentan usar un Refresh Token para cambiar la clave)
            //Arrange: Simular que el token existe pero es de propósito incorrecto
            mockPrisma.tokens_seguridad.findUnique.mockResolvedValue({ usado: false, proposito: 'REFRESH_TOKEN' });
            //Act & Assert: Ejecutar el método restablecer y esperar que lance BadRequestException
            await expect(useCase.restablecer(payload)).rejects.toThrow(BadRequestException);
        });

        it('Debería lanzar error si el token está expirado', async () => {
            //Arrange: Simular que el token existe pero está expirado
            const mockTokenRecord = {
                usado: false,
                proposito: 'RESET_PASSWORD',
                expira_en: new Date(Date.now() - 10000), // Venció en el pasado
            };
            mockPrisma.tokens_seguridad.findUnique.mockResolvedValue(mockTokenRecord);
            
            //Act & Assert: Ejecutar el método restablecer y esperar que lance BadRequestException
            await expect(useCase.restablecer(payload)).rejects.toThrow(BadRequestException);
        });

        it('Debería lanzar error si la firma (hash) del token no coincide', async () => {
            //Arrange: Simular que el token existe pero la firma no coincide  
            const mockTokenRecord = {
                usado: false,
                proposito: 'RESET_PASSWORD',
                expira_en: new Date(Date.now() + 10000),
            };
            mockPrisma.tokens_seguridad.findUnique.mockResolvedValue(mockTokenRecord);
            //Act & Assert: Ejecutar el método restablecer y esperar que lance BadRequestException
            const invalidPayload = { token_compuesto: 'tokenId.token_HACKER_mock', nueva_password: 'hack' };
            await expect(useCase.restablecer(invalidPayload)).rejects.toThrow(BadRequestException);
        });
    });
});