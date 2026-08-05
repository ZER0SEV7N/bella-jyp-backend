//test/modules/auth/provisionarUsuario.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ProvisionarUsuarioUseCase } from '@/modules/auth/use-cases/provisionarUsuario.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

//Mock de Argon2 para simular el hash de contraseñas
jest.mock('argon2', () => ({
    hash: jest.fn(async () => 'hashed_password_mock'),
    argon2id: 2, //Constante requerida por tu código real
}))

//Mock de Crypto para simular la generación de UUID
jest.mock('crypto', () => ({
    randomUUID: jest.fn(() => 'uuid-1234-5678'),
}));

describe('ProvisionarUsuarioUseCase', () => {
    let useCase: ProvisionarUsuarioUseCase;
    let mockPrisma: any;

    //Configuración inicial antes de cada prueba
    beforeEach(async () => {
        mockPrisma = {
            empleados: { findUnique: jest.fn() },
            usuarios: { findUnique: jest.fn(), create: jest.fn() },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProvisionarUsuarioUseCase,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        useCase = module.get<ProvisionarUsuarioUseCase>(ProvisionarUsuarioUseCase);
    });

    //Limpiar los mocks después de cada prueba
    afterEach(() => jest.clearAllMocks()); //Limpiar todos los mocks después de cada prueba

    it('Deberia crear un usuario exitosamente', async () => {
        //Arrange: Configurar los mocks para simular la existencia del empleado y la creación del usuario
        const dto: Parameters<ProvisionarUsuarioUseCase['execute']>[0] = {
            tipo_documento: 'DNI',
            nro_documento: '12345678',
            email: 'test@jyp.com',
            password: 'password123',
            rol: 'ASISTENTE',
        };

        mockPrisma.empleados.findUnique.mockResolvedValue({ id: 'empleado-1' });
        mockPrisma.usuarios.findUnique.mockResolvedValue(null); //Simular que no existe un usuario con el mismo email
        mockPrisma.usuarios.create.mockResolvedValue({
            id: 'user-123',
            rol: 'ASISTENTE',
            empleados: {nro_documento: '12345678', tipo_documento: 'DNI'},
        });

        //Act: Ejecutar el caso de uso
        const result = await useCase.execute(dto);

        //Assert: Verificar que el resultado sea el esperado y que los métodos de Prisma se llamaron correctamente
        expect(result.id).toBe('user-123');
        expect(result.rol).toBe('ASISTENTE');
        expect(result.nro_documento).toBe('12345678');
        expect(mockPrisma.usuarios.findUnique).toHaveBeenCalledWith({
            where: { empleado_id: 'empleado-1' },
        });
        expect(mockPrisma.usuarios.create).toHaveBeenCalled();
    });

    it('Deberia lanzar NotFoundException si el empleado no existe en RRHH', async () => {
        //Arrange: Configurar el mock para simular que el empleado no existe
        const dto: Parameters<ProvisionarUsuarioUseCase['execute']>[0] = {
            tipo_documento: 'DNI',
            nro_documento: '99999999',
            email: 'test@jyp.com',
            password: 'password123',
            rol: 'ASISTENTE',
        };
        mockPrisma.empleados.findUnique.mockResolvedValue(null); //Simular que el empleado no existe

        //Act & Assert: Ejecutar el caso de uso y verificar que se lance la excepción esperada
        await expect(useCase.execute(dto)).rejects.toThrow(NotFoundException);
    });

    it('Deberia lanzar ConflictException si ya existe un usuario con el mismo email', async () => {
        //Arrange: Configurar los mocks para simular la existencia del empleado y un usuario con el mismo email
        const dto: Parameters<ProvisionarUsuarioUseCase['execute']>[0] = {
            tipo_documento: 'DNI',
            nro_documento: '12345678',
            email: 'test@jyp.com',
            password: 'password123',
            rol: 'ASISTENTE',
        };
        //Simular que el empleado existe y que ya hay un usuario con el mismo email
        mockPrisma.empleados.findUnique.mockResolvedValue({ id: 'empleado-1' });
        mockPrisma.usuarios.findUnique.mockResolvedValue({
            id: 'user-123',
            rol: 'ASISTENTE',
            empleados: {nro_documento: '12345678', tipo_documento: 'DNI'},
        });
        

        //Act & Assert: Ejecutar el caso de uso y verificar que se lance la excepción esperada
        await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
    });
});

