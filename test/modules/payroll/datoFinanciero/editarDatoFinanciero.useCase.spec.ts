//test/modules/payroll/datoFinanciero/editarDatoFinanciero.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EditarDatoFinancieroUseCase } from '@/modules/payroll/datoFinanciero/use-case/editarDatoFinanciero.useCase';
import { CryptoUtil } from '@/common/utils/crypto.util';
import type { ActualizarDatoFinancieroDto } from '@jyp/shared-contracts';
import * as argon2 from 'argon2';

//Mock del módulo 'argon2' para controlar la re-confirmación de contraseña (Step-Up Auth)
jest.mock('argon2', () => ({verify: jest.fn() }));

/**
 * Pruebas unitarias para el caso de uso EditarDatoFinancieroUseCase.
 * Estas pruebas validan el comportamiento del caso de uso en diferentes escenarios,
 * incluyendo la autenticación de Step-Up, la re-encriptación de datos sensibles y el manejo de excepciones.
 */
describe('EditarDatoFinancieroUseCase - Pruebas Unitarias de Step-Up Auth y Re-encriptación', () => {
    let useCase: EditarDatoFinancieroUseCase;
    let prismaService: PrismaService;

    //Constantes de prueba
    const TEST_MASTER_KEY = 'jyp_financial_master_key_super_secret_32_bytes_2026!';
    const mockEmpleadoId = '018f4a3c-7b2a-7123-8901-0123456789ab';
    const mockUsuarioAutenticadoId = '018f4a3c-7b2a-7123-8901-0123456789zz';

    //Constantes de prueba para el DTO de actualización
    const dtoEditar: ActualizarDatoFinancieroDto = {
        cuenta_bancaria: '191-99998888-0-99',
        sueldo_basico: 3200.0,
        password_confirmacion: 'PasswordSegura123!'
    };

    //Mock del servicio Prisma para simular la interacción con la base de datos
    const mockPrismaService = {
        dato_financiero: { findUnique: jest.fn(), update: jest.fn() },
        usuarios: { findUnique: jest.fn() }
    };

    beforeAll(() => process.env.FINANCIAL_DATA_ENCRYPTION_KEY = TEST_MASTER_KEY);

    //Configuracion del entorno de pruebas antes de cada test
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EditarDatoFinancieroUseCase,
                { provide: PrismaService, useValue: mockPrismaService }
            ]
        }).compile();

        useCase = module.get<EditarDatoFinancieroUseCase>(EditarDatoFinancieroUseCase);
        prismaService = module.get<PrismaService>(PrismaService);

    });

    afterEach(() => jest.clearAllMocks()); //Limpiar los mocks después de cada prueba

    describe('execute() - Step-Up Authentication y Mutación Sensible', () => {
        it('Debe actualizar y re-encriptar los datos financieros si la contraseña de confirmación (Step-Up) es correcta', async () => {
            //Arrange: Configurar los mocks para simular un escenario exitoso
            mockPrismaService.dato_financiero.findUnique.mockResolvedValue({
                id: 'df-uuid-1',
                empleado_id: mockEmpleadoId,
                deleted_at: null
            });

            //Simular que el usuario autenticado existe y tiene un hash de contraseña válido
            mockPrismaService.usuarios.findUnique.mockResolvedValue({
                id: mockUsuarioAutenticadoId,
                password_hash: '$argon2id$v=19$m=65536,t=3,p=4$hash_seguro'
            });

            (argon2.verify as jest.Mock).mockResolvedValue(true);

            mockPrismaService.dato_financiero.update.mockResolvedValue({
                id: 'df-uuid-1',
                empleado_id: mockEmpleadoId
            });

            //Act: Ejecutar el caso de uso
            const result = await useCase.execute(mockEmpleadoId, dtoEditar, mockUsuarioAutenticadoId);

            //Assert: Verificar que los métodos del servicio Prisma y argon2 se llamaron correctamente
            expect(prismaService.dato_financiero.findUnique).toHaveBeenCalledWith({where: { empleado_id: mockEmpleadoId }});
            expect(prismaService.usuarios.findUnique).toHaveBeenCalledWith({
                where: { id: mockUsuarioAutenticadoId, deleted_at: null },
                select: { password_hash: true }
            });
            expect(argon2.verify).toHaveBeenCalledWith('$argon2id$v=19$m=65536,t=3,p=4$hash_seguro', 'PasswordSegura123!');

            //Verificar que los datos sensibles se re-encriptaron antes de la actualización
            const updateCall = mockPrismaService.dato_financiero.update.mock.calls[0][0];
            expect(CryptoUtil.decrypt(updateCall.data.cuenta_bancaria)).toBe('191-99998888-0-99');
            expect(updateCall.data.sueldo_basico).toBe(3200.0);
            expect(result).toEqual({
                id: 'df-uuid-1',
                empleado_id: mockEmpleadoId,
                mensaje: 'Datos financieros actualizados y re-encriptados correctamente.'
            });
        });

        it('Debe lanzar UnauthorizedException si la contraseña de confirmación es incorrecta', async () => {
            //Arrange: Configurar los mocks para simular un escenario de confirmación fallida
            mockPrismaService.dato_financiero.findUnique.mockResolvedValue({
                id: 'df-uuid-1',
                deleted_at: null
            });

            mockPrismaService.usuarios.findUnique.mockResolvedValue({password_hash: '$argon2id$v=19$hash_real'});

            //Act & Assert: Simular que la verificación de contraseña falla y verificar que se lance UnauthorizedException
            (argon2.verify as jest.Mock).mockResolvedValue(false); //Confirmación fallida
            await expect(useCase.execute(mockEmpleadoId, dtoEditar, mockUsuarioAutenticadoId)).rejects.toThrow(UnauthorizedException);
            expect(prismaService.dato_financiero.update).not.toHaveBeenCalled();
        });

        it('Debe lanzar NotFoundException si el dato financiero del empleado no existe o tiene deleted_at !== null', async () => {
            //Arrange: Configurar los mocks para simular un escenario donde el dato financiero no existe
            mockPrismaService.dato_financiero.findUnique.mockResolvedValue(null);

            //Act & Assert: Verificar que se lance NotFoundException
            await expect(useCase.execute(mockEmpleadoId, dtoEditar, mockUsuarioAutenticadoId)).rejects.toThrow(new NotFoundException('El dato financiero del empleado no existe o ha sido desactivado.'));
            expect(prismaService.usuarios.findUnique).not.toHaveBeenCalled();
        });

        it('Debe lanzar UnauthorizedException si el usuario autenticado que realiza la acción no existe', async () => {
           //Arrange: Configurar los mocks para simular un escenario donde el usuario autenticado no existe
            mockPrismaService.dato_financiero.findUnique.mockResolvedValue({
                id: 'df-uuid-1',
                deleted_at: null
            });

            //Act & Assert: Simular que el usuario autenticado no existe y verificar que se lance UnauthorizedException
            mockPrismaService.usuarios.findUnique.mockResolvedValue(null);
            await expect(useCase.execute(mockEmpleadoId, dtoEditar, mockUsuarioAutenticadoId)).rejects.toThrow(new UnauthorizedException('Usuario no autorizado.'));
        });

        it('Debe lanzar InternalServerErrorException si la actualización en base de datos falla', async () => {
            //Arrange: Configurar los mocks para simular un error de base de datos durante la actualización
            mockPrismaService.dato_financiero.findUnique.mockResolvedValue({ id: 'df-uuid-1', deleted_at: null });
            mockPrismaService.usuarios.findUnique.mockResolvedValue({ password_hash: 'hash' });
            (argon2.verify as jest.Mock).mockResolvedValue(true);

            //Act: Simular un error de base de datos durante la actualización
            mockPrismaService.dato_financiero.update.mockRejectedValue(new Error('PostgreSQL deadlock'));

            //Assert: Verificar que se lance InternalServerErrorException
            await expect(useCase.execute(mockEmpleadoId, dtoEditar, mockUsuarioAutenticadoId)).rejects.toThrow(InternalServerErrorException);
        });
    });
});
