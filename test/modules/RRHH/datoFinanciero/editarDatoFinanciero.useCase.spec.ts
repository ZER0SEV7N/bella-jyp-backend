//test/modules/payroll/datoFinanciero/editarDatoFinanciero.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EditarDatoFinancieroUseCase } from '@/modules/RRHH/datoFinanciero/use-case/editarDatoFinanciero.useCase';
import { CryptoUtil } from '@/common/utils/crypto.util';
import type { ActualizarDatoFinancieroDto } from '@jyp/shared-contracts';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

//Mock del módulo 'argon2' para controlar la re-confirmación de contraseña (Step-Up Auth)
jest.mock('argon2', () => ({ verify: jest.fn() }));

/**
 * Pruebas unitarias para el caso de uso EditarDatoFinancieroUseCase.
 * Estas pruebas validan el comportamiento del caso de uso en diferentes escenarios,
 * incluyendo la autenticación de Step-Up, la re-encriptación de datos sensibles y el manejo de excepciones.
 */
describe('EditarDatoFinancieroUseCase - Pruebas Unitarias de Step-Up Auth y Re-encriptación', () => {
  let useCase: EditarDatoFinancieroUseCase;

  // Constantes de prueba
  const TEST_MASTER_KEY =
    'jyp_financial_master_key_super_secret_32_bytes_2026!';
  const mockEmpleadoId = '018f4a3c-7b2a-7123-8901-0123456789ab';
  const mockUsuarioAutenticadoId = '018f4a3c-7b2a-7123-8901-0123456789zz';

  // Constantes de prueba para el DTO de actualización
  const dtoEditar: ActualizarDatoFinancieroDto = {
    nro_cuenta_sueldo: '191-99998888-0-99',
    sueldo_basico: 3200.0,
    password_confirmacion: 'PasswordSegura123!',
  };

  // Mock del servicio Prisma para simular la interacción con la base de datos
  const mockPrismaService = {
    empleados: {
      findUnique: jest.fn().mockResolvedValue({
        afp_fecha_filiacion: null,
        cargo_id: 'cargo-uuid-1',
      }),
    },
    cargo: {
      findFirst: jest.fn().mockResolvedValue({
        sueldo_minimo: new Prisma.Decimal(1000),
        sueldo_maximo: new Prisma.Decimal(5000),
      }),
    },
    dato_financiero: { findUnique: jest.fn(), update: jest.fn() },
    usuarios: { findUnique: jest.fn() },
    regimen_pension: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'regimen-onp', nombre: 'ONP' }),
    },
    tipo_afp: { findUnique: jest.fn() },
    bancos: { findUnique: jest.fn() },
  };

  beforeAll(() => {
    process.env.FINANCIAL_DATA_ENCRYPTION_KEY = TEST_MASTER_KEY;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EditarDatoFinancieroUseCase,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    useCase = module.get<EditarDatoFinancieroUseCase>(
      EditarDatoFinancieroUseCase
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('Casos de Éxito (Happy Path)', () => {
    it('Debe actualizar y re-encriptar los datos financieros si la contraseña de confirmación (Step-Up) es correcta', async () => {
      // Arrange: Configurar los mocks para simular un escenario exitoso
      mockPrismaService.dato_financiero.findUnique.mockResolvedValue({
        id: 'df-uuid-1',
        empleado_id: mockEmpleadoId,
        deleted_at: null,
      });

      // Simular que el usuario autenticado existe y tiene un hash de contraseña válido
      mockPrismaService.usuarios.findUnique.mockResolvedValue({
        id: mockUsuarioAutenticadoId,
        password_hash: '$argon2id$v=19$m=65536,t=3,p=4$hash_seguro',
      });

      (argon2.verify as jest.Mock).mockResolvedValue(true);

      mockPrismaService.dato_financiero.update.mockResolvedValue({
        id: 'df-uuid-1',
        empleado_id: mockEmpleadoId,
      });

      // Act: Ejecutar el caso de uso
      const result = await useCase.execute(
        mockEmpleadoId,
        dtoEditar,
        mockUsuarioAutenticadoId
      );

      // Assert: Verificar que los métodos del servicio Prisma y argon2 se llamaron correctamente
      expect(mockPrismaService.dato_financiero.findUnique).toHaveBeenCalledWith(
        {
          where: { empleado_id: mockEmpleadoId },
        }
      );
      expect(mockPrismaService.usuarios.findUnique).toHaveBeenCalledWith({
        where: { id: mockUsuarioAutenticadoId, deleted_at: null },
        select: { password_hash: true },
      });
      expect(argon2.verify).toHaveBeenCalledWith(
        '$argon2id$v=19$m=65536,t=3,p=4$hash_seguro',
        'PasswordSegura123!'
      );

      // Verificar que los datos sensibles se re-encriptaron antes de la actualización
      const updateCalls = mockPrismaService.dato_financiero.update.mock
        .calls as [
        [{ data: { nro_cuenta_sueldo: string; sueldo_basico: number } }],
      ];
      const updateCall = updateCalls[0][0];
      expect(CryptoUtil.decrypt(updateCall.data.nro_cuenta_sueldo)).toBe(
        '191-99998888-0-99'
      );
      expect(updateCall.data.sueldo_basico).toBe(3200.0);
      expect(result).toEqual({
        id: 'df-uuid-1',
        empleado_id: mockEmpleadoId,
        mensaje:
          'Datos financieros actualizados y re-encriptados correctamente.',
      });
    });

    it('Debe actualizar sin validar sueldo ni consultar cargo cuando sueldo_basico es undefined', async () => {
      // Arrange
      const dtoSinSueldo: ActualizarDatoFinancieroDto = {
        nro_cuenta_sueldo: '191-99998888-0-99',
        password_confirmacion: 'PasswordSegura123!',
      };
      mockPrismaService.dato_financiero.findUnique.mockResolvedValue({
        id: 'df-uuid-1',
        empleado_id: mockEmpleadoId,
        id_regimen: 'regimen-onp',
        id_tipo_afp: null,
        cuspp: null,
        tipo_comision: null,
        deleted_at: null,
      });
      mockPrismaService.usuarios.findUnique.mockResolvedValue({
        id: mockUsuarioAutenticadoId,
        password_hash: '$argon2id$v=19$hash',
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      mockPrismaService.dato_financiero.update.mockResolvedValue({
        id: 'df-uuid-1',
        empleado_id: mockEmpleadoId,
      });

      // Act
      const result = await useCase.execute(
        mockEmpleadoId,
        dtoSinSueldo,
        mockUsuarioAutenticadoId
      );

      // Assert
      expect(mockPrismaService.cargo.findFirst).not.toHaveBeenCalled();
      expect(result.id).toBe('df-uuid-1');
    });

    it('Debe validar null como valor explícito al borrar el CUSPP de un régimen AFP', async () => {
      mockPrismaService.dato_financiero.findUnique.mockResolvedValue({
        id: 'df-uuid-1',
        empleado_id: mockEmpleadoId,
        id_regimen: 'regimen-afp',
        id_tipo_afp: 'afp-uuid',
        cuspp: '123456789012',
        tipo_comision: 'FLUJO',
        deleted_at: null,
      });
      mockPrismaService.usuarios.findUnique.mockResolvedValue({
        password_hash: '$argon2id$v=19$hash',
      });
      mockPrismaService.regimen_pension.findUnique.mockResolvedValueOnce({
        id: 'regimen-afp',
        nombre: 'AFP',
      });
      mockPrismaService.tipo_afp.findUnique.mockResolvedValueOnce({
        id: 'afp-uuid',
        id_regimen: 'regimen-afp',
      });
      mockPrismaService.empleados.findUnique.mockResolvedValueOnce({
        afp_fecha_filiacion: new Date('2020-01-01'),
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(
        useCase.execute(
          mockEmpleadoId,
          {
            cuspp: null,
            password_confirmacion: 'PasswordSegura123!',
          },
          mockUsuarioAutenticadoId
        )
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.dato_financiero.update).not.toHaveBeenCalled();
    });
  });

  describe('Validaciones de Negocio y Excepciones', () => {
    it('Debe lanzar UnauthorizedException si la contraseña de confirmación es incorrecta', async () => {
      // Arrange: Configurar los mocks para simular un escenario de confirmación fallida
      mockPrismaService.dato_financiero.findUnique.mockResolvedValue({
        id: 'df-uuid-1',
        deleted_at: null,
      });

      mockPrismaService.usuarios.findUnique.mockResolvedValue({
        password_hash: '$argon2id$v=19$hash_real',
      });

      // Act & Assert: Simular que la verificación de contraseña falla y verificar que se lance UnauthorizedException
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      await expect(
        useCase.execute(mockEmpleadoId, dtoEditar, mockUsuarioAutenticadoId)
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrismaService.dato_financiero.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si el dato financiero del empleado no existe o tiene deleted_at !== null', async () => {
      // Arrange: Configurar los mocks para simular un escenario donde el dato financiero no existe
      mockPrismaService.dato_financiero.findUnique.mockResolvedValue(null);

      // Act & Assert: Verificar que se lance NotFoundException
      await expect(
        useCase.execute(mockEmpleadoId, dtoEditar, mockUsuarioAutenticadoId)
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.usuarios.findUnique).not.toHaveBeenCalled();
    });

    it('Debe lanzar UnauthorizedException si el usuario autenticado que realiza la acción no existe', async () => {
      // Arrange: Configurar los mocks para simular un escenario donde el usuario autenticado no existe
      mockPrismaService.dato_financiero.findUnique.mockResolvedValue({
        id: 'df-uuid-1',
        deleted_at: null,
      });
      mockPrismaService.usuarios.findUnique.mockResolvedValue(null);

      // Act & Assert: Simular que el usuario autenticado no existe y verificar que se lance UnauthorizedException
      await expect(
        useCase.execute(mockEmpleadoId, dtoEditar, mockUsuarioAutenticadoId)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('Debe lanzar InternalServerErrorException si la actualización en base de datos falla', async () => {
      // Arrange: Configurar los mocks para simular un error de base de datos durante la actualización
      mockPrismaService.dato_financiero.findUnique.mockResolvedValue({
        id: 'df-uuid-1',
        deleted_at: null,
      });
      mockPrismaService.usuarios.findUnique.mockResolvedValue({
        password_hash: 'hash',
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      // Act: Simular un error de base de datos durante la actualización
      mockPrismaService.dato_financiero.update.mockRejectedValue(
        new Error('PostgreSQL deadlock')
      );

      // Assert: Verificar que se lance InternalServerErrorException
      await expect(
        useCase.execute(mockEmpleadoId, dtoEditar, mockUsuarioAutenticadoId)
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('Debe lanzar NotFoundException con title y detail si el empleado no existe al validar sueldo_basico', async () => {
      // Arrange
      mockPrismaService.dato_financiero.findUnique.mockResolvedValue({
        id: 'df-uuid-1',
        id_regimen: 'regimen-onp',
        id_tipo_afp: null,
        cuspp: null,
        tipo_comision: null,
        deleted_at: null,
      });
      mockPrismaService.usuarios.findUnique.mockResolvedValue({
        password_hash: 'hash',
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      mockPrismaService.empleados.findUnique.mockResolvedValueOnce({
        afp_fecha_filiacion: null,
      });
      mockPrismaService.empleados.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      let capturado: unknown;
      try {
        await useCase.execute(
          mockEmpleadoId,
          dtoEditar,
          mockUsuarioAutenticadoId
        );
      } catch (error) {
        capturado = error;
      }
      expect(capturado).toBeInstanceOf(NotFoundException);
      expect((capturado as NotFoundException).getResponse()).toEqual({
        title: 'Empleado o cargo no encontrado',
        detail:
          'No se encontró el colaborador o no cuenta con un cargo asignado.',
      });
      expect(mockPrismaService.dato_financiero.update).not.toHaveBeenCalled();
    });

    it('Debe propagar BadRequestException cuando el nuevo sueldo está fuera de rango del cargo', async () => {
      // Arrange
      mockPrismaService.dato_financiero.findUnique.mockResolvedValue({
        id: 'df-uuid-1',
        id_regimen: 'regimen-onp',
        id_tipo_afp: null,
        cuspp: null,
        tipo_comision: null,
        deleted_at: null,
      });
      mockPrismaService.usuarios.findUnique.mockResolvedValue({
        password_hash: 'hash',
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      mockPrismaService.cargo.findFirst.mockResolvedValueOnce({
        sueldo_minimo: new Prisma.Decimal(4000),
        sueldo_maximo: new Prisma.Decimal(6000),
      });

      // Act & Assert
      await expect(
        useCase.execute(mockEmpleadoId, dtoEditar, mockUsuarioAutenticadoId)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.dato_financiero.update).not.toHaveBeenCalled();
    });
  });
});
