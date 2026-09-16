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

  const mockPrismaService = { dato_financiero: { findUnique: jest.fn() } };

  beforeAll(() => process.env.FINANCIAL_DATA_ENCRYPTION_KEY = TEST_MASTER_KEY);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObtenerDatoFinancieroUseCase,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    useCase = module.get<ObtenerDatoFinancieroUseCase>(ObtenerDatoFinancieroUseCase);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('Casos de Éxito (Happy Path)', () => {
    it('Debe retornar los datos financieros desencriptados y dinámicamente enmascarados para Sueldo y CTS', async () => {
      // Arrange: Encriptar datos sensibles para simular el almacenamiento real en BD
      const encryptedNroCuentaSueldo = CryptoUtil.encrypt('191-12345678-0-12')!;
      const encryptedCciSueldo = CryptoUtil.encrypt('0021910012345678012388')!;
      const encryptedNroCuentaCts = CryptoUtil.encrypt('191-98765432-1-01')!;
      const encryptedCciCts = CryptoUtil.encrypt('0021910098765432101299')!;

      mockPrismaService.dato_financiero.findUnique.mockResolvedValue({
        id: 'df-uuid-100',
        empleado_id: mockEmpleadoId,
        id_regimen: 'regimen-uuid-1',
        id_tipo_afp: 'afp-uuid-1',
        sueldo_basico: '2800.5000',
        cuspp: '123456ABCDEF', //CUSPP en texto plano (enmascarado a 3 dígitos)
        tipo_comision: 'MIXTA',

        // Sueldo
        id_banco_sueldo: 'banco-sueldo-uuid',
        tipo_cuenta_sueldo: 'SUELDO',
        nro_cuenta_sueldo: encryptedNroCuentaSueldo,
        cci_sueldo: encryptedCciSueldo,

        // CTS
        id_banco_cts: 'banco-cts-uuid',
        tipo_cuenta_cts: 'AHORROS',
        nro_cuenta_cts: encryptedNroCuentaCts,
        cci_cts: encryptedCciCts,

        // Régimen Salud
        regimen_salud: 'ESSALUD_REGULAR',
        eps_nombre: null,
        eps_plan: null,
        eps_costo_adicional: '0.0000',

        deleted_at: null,
        created_at: new Date('2026-09-01'),
        updated_at: new Date('2026-09-01'),

        regimen_pension: { nombre: 'SPP (AFP)' },
        tipo_afp: { nombre: 'AFP INTEGRA' },
        banco_sueldo: { nombre: 'Banco de Crédito del Perú (BCP)' },
        banco_cts: { nombre: 'BBVA Perú' },
      });

      // Act: Ejecutar el caso de uso
      const result = await useCase.execute(mockEmpleadoId);

      // Assert: Verificar la consulta Prisma y las relaciones incluidas
      expect(prismaService.dato_financiero.findUnique).toHaveBeenCalledWith({
        where: { empleado_id: mockEmpleadoId },
        include: {
          regimen_pension: { select: { nombre: true } },
          tipo_afp: { select: { nombre: true } },
          banco_sueldo: { select: { nombre: true } },
          banco_cts: { select: { nombre: true } },
        },
      });

      // Verificar enmascaramiento dinámico (mostrar últimos 4 caracteres para cuentas y 3 para CUSPP)
      expect(result.nro_cuenta_sueldo).toBe('*************0-12');
      expect(result.cci_sueldo).toBe('******************2388');
      expect(result.nro_cuenta_cts).toBe('*************1-01');
      expect(result.cci_cts).toBe('******************1299');
      expect(result.cuspp).toBe('*********DEF');

      expect(result.sueldo_basico).toBe(2800.5);
      expect(result.regimen_nombre).toBe('SPP (AFP)');
      expect(result.afp_nombre).toBe('AFP INTEGRA');
      expect(result.banco_sueldo_nombre).toBe('Banco de Crédito del Perú (BCP)');
      expect(result.banco_cts_nombre).toBe('BBVA Perú');
    });
  });

  describe('Validaciones de Negocio y Excepciones', () => {
    it('Debe lanzar NotFoundException si no se encuentran datos financieros registrados para el empleado', async () => {
      // Arrange: Simular que el empleado no posee ficha financiera
      mockPrismaService.dato_financiero.findUnique.mockResolvedValue(null);

      // Act & Assert: Ejecutar el caso de uso y verificar NotFoundException
      await expect(useCase.execute(mockEmpleadoId)).rejects.toThrow(NotFoundException);
    });

    it('Debe lanzar NotFoundException si el dato financiero fue eliminado lógicamente (deleted_at !== null)', async () => {
      // Arrange: Simular que la ficha financiera se encuentra con soft-delete
      mockPrismaService.dato_financiero.findUnique.mockResolvedValue({
        id: 'df-uuid-101',
        deleted_at: new Date('2026-01-01'),
      });

      // Act & Assert: Ejecutar el caso de uso y verificar que se rechace
      await expect(useCase.execute(mockEmpleadoId)).rejects.toThrow(NotFoundException);
    });
  });
});