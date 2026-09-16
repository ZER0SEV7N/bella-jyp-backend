//test/modules/payroll/datoFinanciero/datoFinanciero.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DatoFinancieroController } from '@/modules/payroll/datoFinanciero/controller/datoFinanciero.controller';
import { AgregarDatoFinancieroUseCase } from '@/modules/payroll/datoFinanciero/use-case/agregarDatoFinanciero.useCase';
import { EditarDatoFinancieroUseCase } from '@/modules/payroll/datoFinanciero/use-case/editarDatoFinanciero.useCase';
import { ObtenerDatoFinancieroUseCase } from '@/modules/payroll/datoFinanciero/use-case/obtenerDatoFinanciero.useCase';
import type { CrearDatoFinancieroDto, ActualizarDatoFinancieroDto } from '@jyp/shared-contracts';
import type { FastifyRequest } from 'fastify';
import { NotFoundException } from '@nestjs/common';

/**
 * Pruebas unitarias para el DatoFinancieroController.
 * Estas pruebas validan la correcta delegación de las solicitudes HTTP a los casos de uso correspondientes,
 * así como la correcta extracción de parámetros y datos del request, incluyendo el manejo de roles y autenticación.
 * Se simulan los casos de uso mediante mocks para aislar el comportamiento del controlador.
 */
describe('DatoFinancieroController - Cobertura HTTP y RBAC', () => {
  // Variables de prueba y mocks
  let controller: DatoFinancieroController;
  let agregarDatoFinancieroUseCase: AgregarDatoFinancieroUseCase;
  let editarDatoFinancieroUseCase: EditarDatoFinancieroUseCase;
  let obtenerDatoFinancieroUseCase: ObtenerDatoFinancieroUseCase;

  const mockEmpleadoId = '018f4a3c-7b2a-7123-8901-0123456789ab';
  const mockUsuarioId = '018f4a3c-7b2a-7123-8901-0123456789zz';

  const mockAgregarUseCase = { execute: jest.fn() };
  const mockEditarUseCase = { execute: jest.fn() };
  const mockObtenerUseCase = { execute: jest.fn() };

  // Configuración del entorno de pruebas antes de cada test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DatoFinancieroController],
      providers: [
        { provide: AgregarDatoFinancieroUseCase, useValue: mockAgregarUseCase },
        { provide: EditarDatoFinancieroUseCase, useValue: mockEditarUseCase },
        { provide: ObtenerDatoFinancieroUseCase, useValue: mockObtenerUseCase },
      ],
    }).compile();

    controller = module.get<DatoFinancieroController>(DatoFinancieroController);
    agregarDatoFinancieroUseCase = module.get<AgregarDatoFinancieroUseCase>(AgregarDatoFinancieroUseCase);
    editarDatoFinancieroUseCase = module.get<EditarDatoFinancieroUseCase>(EditarDatoFinancieroUseCase);
    obtenerDatoFinancieroUseCase = module.get<ObtenerDatoFinancieroUseCase>(ObtenerDatoFinancieroUseCase);
  });

  afterEach(() => jest.clearAllMocks()); // Limpiar los mocks después de cada prueba

  // =========================================================================
  // 1. GET /api/dato-financiero/empleado/:empleadoId - obtenerPorEmpleado
  // =========================================================================
  describe('GET /api/dato-financiero/empleado/:empleadoId - obtenerPorEmpleado', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe delegar la consulta al ObtenerDatoFinancieroUseCase pasando el empleadoId', async () => {
        // Arrange
        const mockResponse = {
          id: 'df-uuid-1',
          empleado_id: mockEmpleadoId,
          sueldo_basico: 3000,
          cuspp: '*********DEF',
          tipo_comision: 'FLUJO',
          id_banco_sueldo: 'banco-sueldo-uuid',
          banco_sueldo_nombre: 'Banco de Crédito del Perú (BCP)',
          tipo_cuenta_sueldo: 'SUELDO',
          nro_cuenta_sueldo: '*************0-12',
          cci_sueldo: '******************2388',
          id_banco_cts: 'banco-cts-uuid',
          banco_cts_nombre: 'BBVA Perú',
          tipo_cuenta_cts: 'AHORROS',
          nro_cuenta_cts: '*************1-01',
          cci_cts: '******************1299',
          regimen_salud: 'ESSALUD_REGULAR',
          eps_costo_adicional: 0,
        };

        mockObtenerUseCase.execute.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.obtenerDatos(mockEmpleadoId);

        // Assert
        expect(obtenerDatoFinancieroUseCase.execute).toHaveBeenCalledWith(mockEmpleadoId);
        expect(result).toEqual(mockResponse);
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe lanzar NotFoundException si el caso de uso no encuentra datos financieros para el empleado', async () => {
        // Arrange
        mockObtenerUseCase.execute.mockRejectedValue(
          new NotFoundException('No se encontraron datos financieros registrados para el empleado.'),
        );

        // Act & Assert
        await expect(controller.obtenerDatos(mockEmpleadoId)).rejects.toThrow(NotFoundException);
      });
    });
  });

  // =========================================================================
  // 2. POST /api/dato-financiero - crear
  // =========================================================================
  describe('POST /api/dato-financiero - crear', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe procesar la creación de datos financieros invocando a AgregarDatoFinancieroUseCase', async () => {
        // Arrange
        const payload: CrearDatoFinancieroDto = {
          empleado_id: mockEmpleadoId,
          id_regimen: '018f4a3c-7b2a-7123-8901-0123456789ac',
          id_tipo_afp: '018f4a3c-7b2a-7123-8901-0123456789ad',
          sueldo_basico: 2500,
          cuspp: '123456ABCDEF',
          tipo_comision: 'FLUJO',
          id_banco_sueldo: '018f4a3c-7b2a-7123-8901-0123456789ae',
          tipo_cuenta_sueldo: 'SUELDO',
          nro_cuenta_sueldo: '191-12345678-0-12',
          cci_sueldo: '002-191-00123456780123-88',
          id_banco_cts: '018f4a3c-7b2a-7123-8901-0123456789af',
          tipo_cuenta_cts: 'AHORROS',
          nro_cuenta_cts: '191-98765432-1-01',
          cci_cts: '002-191-00987654321012-99',
          regimen_salud: 'ESSALUD_REGULAR',
          eps_costo_adicional: 0,
        };

        const mockResponse = {
          id: 'df-created-uuid',
          empleado_id: mockEmpleadoId,
          mensaje: 'Datos financieros del colaborador registrados exitosamente.',
        };

        mockAgregarUseCase.execute.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.crear(payload);

        // Assert
        expect(agregarDatoFinancieroUseCase.execute).toHaveBeenCalledWith(payload);
        expect(result).toEqual(mockResponse);
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe lanzar NotFoundException si el empleado no existe al crear datos financieros', async () => {
        // Arrange
        const payload: CrearDatoFinancieroDto = {
          empleado_id: mockEmpleadoId,
          id_regimen: '018f4a3c-7b2a-7123-8901-0123456789ac',
          sueldo_basico: 2500,
          tipo_cuenta_sueldo: 'SUELDO',
          tipo_cuenta_cts: 'AHORROS',
          regimen_salud: 'ESSALUD_REGULAR',
          eps_costo_adicional: 0,
        };

        mockAgregarUseCase.execute.mockRejectedValue(
          new NotFoundException('Empleado no encontrado o ha sido eliminado recientemente.'),
        );

        // Act & Assert
        await expect(controller.crear(payload)).rejects.toThrow(NotFoundException);
      });
    });
  });

  // =========================================================================
  // 3. PATCH /api/dato-financiero/empleado/:empleadoId - actualizar
  // =========================================================================
  describe('PATCH /api/dato-financiero/empleado/:empleadoId - actualizar', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe actualizar datos financieros extrayendo el ID del usuario autenticado del request y pasándolo al UseCase', async () => {
        // Arrange
        const payload: ActualizarDatoFinancieroDto = {
          sueldo_basico: 3500,
          nro_cuenta_sueldo: '191-99998888-0-99',
          password_confirmacion: 'PasswordActual123!',
        };

        const mockRequest = { user: { id: mockUsuarioId } } as FastifyRequest & { user: { id: string } };

        const mockResponse = {
          id: 'df-uuid-1',
          empleado_id: mockEmpleadoId,
          mensaje: 'Datos financieros actualizados y re-encriptados correctamente.',
        };

        mockEditarUseCase.execute.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.actualizar(mockEmpleadoId, payload, mockRequest);

        // Assert
        expect(editarDatoFinancieroUseCase.execute).toHaveBeenCalledWith(
          mockEmpleadoId,
          payload,
          mockUsuarioId,
        );
        expect(result).toEqual(mockResponse);
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe lanzar NotFoundException si el dato financiero del empleado no existe al actualizar', async () => {
        // Arrange
        const payload: ActualizarDatoFinancieroDto = {
          sueldo_basico: 3500,
          password_confirmacion: 'PasswordActual123!',
        };

        const mockRequest = { user: { id: mockUsuarioId } } as FastifyRequest & { user: { id: string } };

        mockEditarUseCase.execute.mockRejectedValue(
          new NotFoundException('El dato financiero del empleado no existe o ha sido desactivado.'),
        );

        // Act & Assert
        await expect(controller.actualizar(mockEmpleadoId, payload, mockRequest)).rejects.toThrow(NotFoundException);
      });
    });
  });
});