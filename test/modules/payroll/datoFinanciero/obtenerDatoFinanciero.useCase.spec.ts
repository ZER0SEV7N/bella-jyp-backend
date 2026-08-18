import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ObtenerDatoFinancieroUseCase } from '@/modules/payroll/datoFinanciero/use-case/obtenerDatoFinanciero.useCase';
import { CryptoUtil } from '@/common/utils/crypto.util';

describe('ObtenerDatoFinancieroUseCase - Pruebas Unitarias de Enmascaramiento Sensible', () => {
    let useCase: ObtenerDatoFinancieroUseCase;
    let prismaService: PrismaService;

    const TEST_MASTER_KEY = 'jyp_financial_master_key_super_secret_32_bytes_2026!';
    const mockEmpleadoId = '018f4a3c-7b2a-7123-8901-0123456789ab';

    const mockPrismaService = {
        dato_financiero: {findUnique: jest.fn()}
    };

    beforeAll(() => process.env.FINANCIAL_DATA_ENCRYPTION_KEY = TEST_MASTER_KEY);

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ObtenerDatoFinancieroUseCase,
                { provide: PrismaService, useValue: mockPrismaService },
            ]
        }).compile();

        useCase = module.get<ObtenerDatoFinancieroUseCase>(ObtenerDatoFinancieroUseCase);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => jest.clearAllMocks()); //Limpiar los mocks después de cada prueba

    describe('execute() - Desencriptación Temporal y Data Masking', () => {
        it('Happy Path: Debe retornar los datos financieros desencriptados y dinámicamente enmascarados (incluyendo CUSPP)', async () => {
            const encryptedCuenta = CryptoUtil.encrypt('191-12345678-0-12')!;
            const encryptedCci = CryptoUtil.encrypt('0021910012345678012388')!;
            const encryptedCts = CryptoUtil.encrypt('191-98765432-1-01')!;
            const encryptedCuspp = CryptoUtil.encrypt('123456ABCDEF')!;

            mockPrismaService.dato_financiero.findUnique.mockResolvedValue({
                id: 'df-uuid-100',
                empleado_id: mockEmpleadoId,
                id_regimen: 'regimen-uuid-1',
                id_tipo_afp: 'afp-uuid-1',
                id_banco: 'banco-uuid-1',
                cuenta_bancaria: encryptedCuenta,
                cci: encryptedCci,
                nro_cuenta_cts: encryptedCts,
                sueldo_basico: '2800.5000',
                cuspp: encryptedCuspp,
                tipo_comision: 'MIXTA',
                deleted_at: null,
                bancos: { nombre: 'Banco de Crédito del Perú (BCP)' },
                regimen_pension: { nombre: 'SPP (AFP)' },
                tipo_afp: { nombre: 'AFP INTEGRA' }
            });

            const result = await useCase.execute(mockEmpleadoId);

            expect(prismaService.dato_financiero.findUnique).toHaveBeenCalledWith({
                where: { empleado_id: mockEmpleadoId },
                include: expect.any(Object),
            });

            // Verificar enmascaramiento dinámico (mostrar últimos 4 caracteres)
            expect(result.cuenta_bancaria).toBe('*************0-12');
            expect(result.cci).toBe('******************2388');
            expect(result.nro_cuenta_cts).toBe('*************1-01');
            expect(result.cuspp).toBe('********CDEF');

            expect(result.sueldo_basico).toBe(2800.5);
            expect(result.regimen_nombre).toBe('SPP (AFP)');
            expect(result.banco_nombre).toBe('Banco de Crédito del Perú (BCP)');
            expect(result.afp_nombre).toBe('AFP INTEGRA');
        });

        it('Excepción: Debe lanzar NotFoundException si no se encuentran datos financieros registrados para el empleado', async () => {
            mockPrismaService.dato_financiero.findUnique.mockResolvedValue(null);

            await expect(useCase.execute(mockEmpleadoId)).rejects.toThrow(new NotFoundException('No se encontraron datos financieros registrados para el empleado.'));
        });

        it('Excepción: Debe lanzar NotFoundException si el dato financiero fue eliminado lógicamente (deleted_at !== null)', async () => {
            mockPrismaService.dato_financiero.findUnique.mockResolvedValue({
                id: 'df-uuid-101',
                deleted_at: new Date('2026-01-01'),
            });

            await expect(useCase.execute(mockEmpleadoId)).rejects.toThrow(new NotFoundException('No se encontraron datos financieros registrados para el empleado.'));
        });
    });
});