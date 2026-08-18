//test/modules/payroll/datoFinanciero/datoFinanciero.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AgregarDatoFinancieroUseCase } from '@/modules/payroll/datoFinanciero/use-case/agregarDatoFinanciero.useCase';
import { CryptoUtil } from '@/common/utils/crypto.util';
import type { CrearDatoFinancieroDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias para el caso de uso AgregarDatoFinancieroUseCase.
 * Estas pruebas validan el comportamiento del caso de uso en diferentes escenarios,
 * incluyendo la encriptación de datos sensibles, la validación de existencia de registros y el manejo de excepciones.
 */
describe('AgregarDatoFinancieroUseCase - Pruebas Unitarias de Cifrado y Registro', () => {
    let useCase: AgregarDatoFinancieroUseCase;
    let prismaService: PrismaService;

    //Constantes de prueba
    const TEST_MASTER_KEY = 'jyp_financial_master_key_super_secret_32_bytes_2026!';
    const mockEmpleadoId = '018f4a3c-7b2a-7123-8901-0123456789ab';
    const mockRegimenId = '018f4a3c-7b2a-7123-8901-0123456789ac';
    const mockAfpId = '018f4a3c-7b2a-7123-8901-0123456789ad';
    const mockBancoId = '018f4a3c-7b2a-7123-8901-0123456789ae';

    //Constantes de prueba para el DTO
    const dtoCrear: CrearDatoFinancieroDto = {
        empleado_id: mockEmpleadoId,
        id_regimen: mockRegimenId,
        id_tipo_afp: mockAfpId,
        id_banco: mockBancoId,
        cuenta_bancaria: '191-12345678-0-12',
        cci: '002-191-00123456780123-88',
        nro_cuenta_cts: '191-98765432-1-01',
        sueldo_basico: 2500.00,
        cuspp: '123456ABCDEF',
        tipo_comision: 'FLUJO'
    };

    const mockPrismaService = {
        empleados: { findUnique: jest.fn() },
        dato_financiero: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
        regimen_pension: { findUnique: jest.fn() },
        tipo_afp: { findUnique: jest.fn() },
        bancos: { findUnique: jest.fn() }
    }

    //Configuracion del entorno de pruebas antes de cada test
    beforeAll(() => process.env.FINANCIAL_DATA_ENCRYPTION_KEY = TEST_MASTER_KEY);

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AgregarDatoFinancieroUseCase,
                { provide: PrismaService, useValue: mockPrismaService }
            ],
        }).compile();
        
        useCase = module.get<AgregarDatoFinancieroUseCase>(AgregarDatoFinancieroUseCase);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    //Limpiar los mocks despues de cada test para evitar interferencias entre pruebas
    afterEach(() => jest.clearAllMocks());

    describe('execute() - Registre Cifrado Sensible', () => {
        it('Debe registrar exitosamente los datos financiero guardando los campos sensibles cifrados con AES-256-GCM', async () => {
            //Arrange
            mockPrismaService.empleados.findUnique.mockResolvedValue({ id:mockEmpleadoId, deleted_at: null });
            mockPrismaService.dato_financiero.findUnique.mockResolvedValue(null);
            mockPrismaService.regimen_pension.findUnique.mockResolvedValue({ id: mockRegimenId });
            mockPrismaService.tipo_afp.findUnique.mockResolvedValue({ id: mockAfpId });
            mockPrismaService.bancos.findUnique.mockResolvedValue({ id: mockBancoId });


            const mockCreatedRecord = {
                id: '018f4a3c-7b2a-7123-8901-999999999999',
                empleado_id: mockEmpleadoId
            };
            
            //Act
            mockPrismaService.dato_financiero.create.mockResolvedValue(mockCreatedRecord);
            const result = await useCase.execute(dtoCrear);

            //Assert
            expect(prismaService.empleados.findUnique).toHaveBeenCalledWith({where: { id: mockEmpleadoId, deleted_at: null }});
            expect(prismaService.dato_financiero.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                empleado_id: mockEmpleadoId,
                id_regimen: mockRegimenId,
                sueldo_basico: 2500.0,
                cuenta_bancaria: expect.stringMatching(/^enc:v1:/),
                cci: expect.stringMatching(/^enc:v1:/),
                nro_cuenta_cts: expect.stringMatching(/^enc:v1:/),
                })
            });

            //Verificar que los datos enviados a create se puedan desencriptar correctamente
            const callData = mockPrismaService.dato_financiero.create.mock.calls[0][0].data;
            expect(CryptoUtil.decrypt(callData.cuenta_bancaria)).toBe('191-12345678-0-12');
            expect(CryptoUtil.decrypt(callData.cci)).toBe('002-191-00123456780123-88');
            expect(CryptoUtil.decrypt(callData.nro_cuenta_cts)).toBe('191-98765432-1-01');

            expect(result).toEqual({
                id: mockCreatedRecord.id,
                empleado_id: mockEmpleadoId,
                mensaje: 'Datos financieros del empleado registrados exitosamente.'
            });
        });

        it('Debe lanzar NotFoundException si el empleado no existe o ha sido eliminado', async () => {
            //Arrange
            mockPrismaService.empleados.findUnique.mockResolvedValue(null);

            //Act & Assert
            await expect(useCase.execute(dtoCrear)).rejects.toThrow(new NotFoundException('Empleado no encontrado o ha sido eliminado recientemente.'));
            expect(prismaService.empleados.findUnique).toHaveBeenCalledWith({where: { id: mockEmpleadoId, deleted_at: null }});
        });

        it('Debe lanzar ConflictException si ya existe ya posee un registro financiero activo', async () => {
            //Arrange
            mockPrismaService.empleados.findUnique.mockResolvedValue({ id: mockEmpleadoId, deleted_at: null });
            mockPrismaService.dato_financiero.findFirst.mockResolvedValue({ id: 'existing-df-uuid', empleado_id: mockEmpleadoId });

            //Act & Assert
            await expect(useCase.execute(dtoCrear)).rejects.toThrow(new ConflictException('Ya existe un registro de datos financieros para este empleado. No se puede crear un duplicado.'));
            expect(prismaService.dato_financiero.findFirst).toHaveBeenCalledWith({where: { empleado_id: mockEmpleadoId, deleted_at: null }});
            expect(prismaService.dato_financiero.create).not.toHaveBeenCalled();
        });

        
        it('Excepción: Debe lanzar NotFoundException si el banco especificado no existe', async () => {
            //Arrange
            mockPrismaService.empleados.findUnique.mockResolvedValue({ id: mockEmpleadoId, deleted_at: null });
            mockPrismaService.dato_financiero.findFirst.mockResolvedValue(null);
            mockPrismaService.dato_financiero.findUnique.mockResolvedValue(null);
            mockPrismaService.regimen_pension.findUnique.mockResolvedValue({ id: mockRegimenId });
            mockPrismaService.tipo_afp.findUnique.mockResolvedValue({ id: mockAfpId });
            mockPrismaService.bancos.findUnique.mockResolvedValue(null);

            //Act & Assert
            await expect(useCase.execute(dtoCrear)).rejects.toThrow(new NotFoundException('El banco especificado no existe.'));
        });

        it('Resiliencia: Debe transformar errores no previstos de base de datos a InternalServerErrorException', async () => {
            //Arrange
            mockPrismaService.empleados.findUnique.mockResolvedValue({ id: mockEmpleadoId, deleted_at: null });
            mockPrismaService.dato_financiero.findFirst.mockResolvedValue(null);
            mockPrismaService.dato_financiero.findUnique.mockResolvedValue(null);
            mockPrismaService.regimen_pension.findUnique.mockResolvedValue({ id: mockRegimenId });
            mockPrismaService.tipo_afp.findUnique.mockResolvedValue({ id: mockAfpId });
            mockPrismaService.bancos.findUnique.mockResolvedValue({ id: mockBancoId });
            mockPrismaService.dato_financiero.create.mockRejectedValue(new Error('PostgreSQL Connection Error'));

            //Act & Assert
            await expect(useCase.execute(dtoCrear)).rejects.toThrow(InternalServerErrorException);
        });
    });
}) 