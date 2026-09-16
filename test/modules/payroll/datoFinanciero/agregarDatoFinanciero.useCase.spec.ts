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

  // Constantes de prueba
  const TEST_MASTER_KEY = 'jyp_financial_master_key_super_secret_32_bytes_2026!';
  const mockEmpleadoId = '018f4a3c-7b2a-7123-8901-0123456789ab';
  const mockRegimenId = '018f4a3c-7b2a-7123-8901-0123456789ac';
  const mockAfpId = '018f4a3c-7b2a-7123-8901-0123456789ad';
  const mockBancoSueldoId = '018f4a3c-7b2a-7123-8901-0123456789ae';
  const mockBancoCtsId = '018f4a3c-7b2a-7123-8901-0123456789af';

  // DTO actualizado con split bancario y EPS
  const dtoCrear: CrearDatoFinancieroDto = {
    empleado_id: mockEmpleadoId,
    id_regimen: mockRegimenId,
    id_tipo_afp: mockAfpId,
    sueldo_basico: 2500.0,
    cuspp: '123456ABCDEF',
    tipo_comision: 'FLUJO',

    // Cuenta de Sueldo
    id_banco_sueldo: mockBancoSueldoId,
    tipo_cuenta_sueldo: 'SUELDO',
    nro_cuenta_sueldo: '191-12345678-0-12',
    cci_sueldo: '002-191-00123456780123-88',

    // Cuenta de CTS
    id_banco_cts: mockBancoCtsId,
    tipo_cuenta_cts: 'AHORROS',
    nro_cuenta_cts: '191-98765432-1-01',
    cci_cts: '002-191-00987654321012-99',

    // Aseguramiento de Salud
    regimen_salud: 'ESSALUD_REGULAR',
    eps_costo_adicional: 0,
  };

  const mockPrismaService = {
    empleados: { findUnique: jest.fn() },
    dato_financiero: { findFirst: jest.fn(), create: jest.fn() },
    regimen_pension: { findUnique: jest.fn() },
    tipo_afp: { findUnique: jest.fn() },
    bancos: { findUnique: jest.fn() },
  };

  beforeAll(() => {
    process.env.FINANCIAL_DATA_ENCRYPTION_KEY = TEST_MASTER_KEY;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgregarDatoFinancieroUseCase,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    useCase = module.get<AgregarDatoFinancieroUseCase>(AgregarDatoFinancieroUseCase);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('Casos de Éxito (Happy Path)', () => {
    it('Debe registrar exitosamente los datos financieros guardando los campos sensibles cifrados con AES-256-GCM', async () => {
      // Arrange
      mockPrismaService.empleados.findUnique.mockResolvedValue({ id: mockEmpleadoId, deleted_at: null });
      mockPrismaService.dato_financiero.findFirst.mockResolvedValue(null);
      mockPrismaService.regimen_pension.findUnique.mockResolvedValue({ id: mockRegimenId });
      mockPrismaService.tipo_afp.findUnique.mockResolvedValue({ id: mockAfpId });
      mockPrismaService.bancos.findUnique.mockResolvedValue({ id: 'banco-valido' });

      const mockCreatedRecord = {
        id: '018f4a3c-7b2a-7123-8901-999999999999',
        empleado_id: mockEmpleadoId,
      };

      mockPrismaService.dato_financiero.create.mockResolvedValue(mockCreatedRecord);

      // Act
      const result = await useCase.execute(dtoCrear);

      // Assert
      expect(prismaService.empleados.findUnique).toHaveBeenCalledWith({
        where: { id: mockEmpleadoId, deleted_at: null },
      });

      expect(prismaService.dato_financiero.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          empleado_id: mockEmpleadoId,
          id_regimen: mockRegimenId,
          id_tipo_afp: mockAfpId,
          sueldo_basico: 2500.0,
          id_banco_sueldo: mockBancoSueldoId,
          tipo_cuenta_sueldo: 'SUELDO',
          id_banco_cts: mockBancoCtsId,
          tipo_cuenta_cts: 'AHORROS',
          regimen_salud: 'ESSALUD_REGULAR',
          nro_cuenta_sueldo: expect.stringMatching(/^enc:v1:/),
          cci_sueldo: expect.stringMatching(/^enc:v1:/),
          nro_cuenta_cts: expect.stringMatching(/^enc:v1:/),
          cci_cts: expect.stringMatching(/^enc:v1:/),
        }),
      });

      // Verificar que los datos enviados a create se puedan desencriptar correctamente
      const callData = mockPrismaService.dato_financiero.create.mock.calls[0][0].data;
      expect(CryptoUtil.decrypt(callData.nro_cuenta_sueldo)).toBe('191-12345678-0-12');
      expect(CryptoUtil.decrypt(callData.cci_sueldo)).toBe('002-191-00123456780123-88');
      expect(CryptoUtil.decrypt(callData.nro_cuenta_cts)).toBe('191-98765432-1-01');
      expect(CryptoUtil.decrypt(callData.cci_cts)).toBe('002-191-00987654321012-99');

      expect(result).toEqual({
        id: mockCreatedRecord.id,
        empleado_id: mockEmpleadoId,
        mensaje: 'Datos financieros del colaborador registrados exitosamente.',
      });
    });
  });

  describe('Validaciones de Negocio y Excepciones', () => {
    it('Debe lanzar NotFoundException si el empleado no existe o ha sido eliminado', async () => {
      // Arrange
      mockPrismaService.empleados.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute(dtoCrear)).rejects.toThrow(NotFoundException);
      expect(prismaService.empleados.findUnique).toHaveBeenCalledWith({
        where: { id: mockEmpleadoId, deleted_at: null },
      });
    });

    it('Debe lanzar ConflictException si el empleado ya posee un registro financiero activo', async () => {
      // Arrange
      mockPrismaService.empleados.findUnique.mockResolvedValue({ id: mockEmpleadoId, deleted_at: null });
      mockPrismaService.dato_financiero.findFirst.mockResolvedValue({ id: 'existing-df-uuid' });

      // Act & Assert
      await expect(useCase.execute(dtoCrear)).rejects.toThrow(ConflictException);
      expect(prismaService.dato_financiero.findFirst).toHaveBeenCalledWith({
        where: { empleado_id: mockEmpleadoId, deleted_at: null },
      });
      expect(prismaService.dato_financiero.create).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si el banco especificado no existe', async () => {
      // Arrange
      mockPrismaService.empleados.findUnique.mockResolvedValue({ id: mockEmpleadoId, deleted_at: null });
      mockPrismaService.dato_financiero.findFirst.mockResolvedValue(null);
      mockPrismaService.regimen_pension.findUnique.mockResolvedValue({ id: mockRegimenId });
      mockPrismaService.tipo_afp.findUnique.mockResolvedValue({ id: mockAfpId });
      mockPrismaService.bancos.findUnique.mockResolvedValue(null); // Banco no encontrado

      // Act & Assert
      await expect(useCase.execute(dtoCrear)).rejects.toThrow(NotFoundException);
    });

    it('Debe transformar errores no previstos de base de datos a InternalServerErrorException', async () => {
      // Arrange
      mockPrismaService.empleados.findUnique.mockResolvedValue({ id: mockEmpleadoId, deleted_at: null });
      mockPrismaService.dato_financiero.findFirst.mockResolvedValue(null);
      mockPrismaService.regimen_pension.findUnique.mockResolvedValue({ id: mockRegimenId });
      mockPrismaService.tipo_afp.findUnique.mockResolvedValue({ id: mockAfpId });
      mockPrismaService.bancos.findUnique.mockResolvedValue({ id: mockBancoSueldoId });
      mockPrismaService.dato_financiero.create.mockRejectedValue(new Error('PostgreSQL Connection Error'));

      // Act & Assert
      await expect(useCase.execute(dtoCrear)).rejects.toThrow(InternalServerErrorException);
    });
  });
});