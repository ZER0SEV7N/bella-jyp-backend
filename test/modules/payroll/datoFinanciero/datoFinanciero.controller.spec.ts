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
    //Variables de prueba y mocks
    let controller: DatoFinancieroController;
    let agregarDatoFinancieroUseCase: AgregarDatoFinancieroUseCase;
    let editarDatoFinancieroUseCase: EditarDatoFinancieroUseCase;
    let obtenerDatoFinancieroUseCase: ObtenerDatoFinancieroUseCase;

    const mockEmpleadoId = '018f4a3c-7b2a-7123-8901-0123456789ab';
    const mockUsuarioId = '018f4a3c-7b2a-7123-8901-0123456789zz';

    const mockAgregarUseCase = { execute: jest.fn() };
    const mockEditarUseCase = { execute: jest.fn() };
    const mockObtenerUseCase = { execute: jest.fn() };

    //Configuracion del entorno de pruebas antes de cada test
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
        controllers: [DatoFinancieroController],
            providers: [
                { provide: AgregarDatoFinancieroUseCase, useValue: mockAgregarUseCase },
                { provide: EditarDatoFinancieroUseCase, useValue: mockEditarUseCase },
                { provide: ObtenerDatoFinancieroUseCase, useValue: mockObtenerUseCase }
            ]
        }).compile();

        controller = module.get<DatoFinancieroController>(DatoFinancieroController);
        agregarDatoFinancieroUseCase = module.get<AgregarDatoFinancieroUseCase>(AgregarDatoFinancieroUseCase);
        editarDatoFinancieroUseCase = module.get<EditarDatoFinancieroUseCase>(EditarDatoFinancieroUseCase);
        obtenerDatoFinancieroUseCase = module.get<ObtenerDatoFinancieroUseCase>(ObtenerDatoFinancieroUseCase);
    });

    afterEach(() => jest.clearAllMocks()); //Limpiar los mocks después de cada prueba

    describe('GET /api/dato-financiero/empleado/:empleadoId - obtenerPorEmpleado', () => {
        it('Debe delegar la consulta al ObtenerDatoFinancieroUseCase pasando el empleadoId', async () => {
            const mockResponse = {
                id: 'df-uuid-1',
                empleado_id: mockEmpleadoId,
                nombre: 'Juan Pérez',
                cuenta_bancaria: '*************0-12',
                cci: '******************2388',
                cuspp: '********CDEF',
                sueldo_basico: 3000
            };

            mockObtenerUseCase.execute.mockResolvedValue(mockResponse);

            const result = await controller.obtenerDatos(mockEmpleadoId);

            expect(obtenerDatoFinancieroUseCase.execute).toHaveBeenCalledWith(mockEmpleadoId);
            expect(result).toEqual(mockResponse);
        });

        it('Debe lanzar NotFoundException si el caso de uso no encuentra datos financieros para el empleado', async () => {
            mockObtenerUseCase.execute.mockRejectedValue(new NotFoundException('No se encontraron datos financieros registrados para el empleado.'));
            await expect(controller.obtenerDatos(mockEmpleadoId)).rejects.toThrow(NotFoundException);
        });
    });

    describe('POST /api/dato-financiero - crear', () => {
        it('Debe procesar la creación de datos financieros invocando a AgregarDatoFinancieroUseCase', async () => {
            const payload: CrearDatoFinancieroDto = {
                empleado_id: mockEmpleadoId,
                id_regimen: '018f4a3c-7b2a-7123-8901-0123456789ac',
                cci: '******************2388',
                cuspp: '********CDEF',
                cuenta_bancaria: '191-12345678-0-12',
                sueldo_basico: 2500
            };

            const mockResponse = {
                id: 'df-created-uuid',
                empleado_id: mockEmpleadoId,
                nombre: 'Juan Pérez',
                mensaje: 'Datos financieros registrados y cifrados exitosamente.'
            };

            mockAgregarUseCase.execute.mockResolvedValue(mockResponse);

            const result = await controller.crear(payload);

            expect(agregarDatoFinancieroUseCase.execute).toHaveBeenCalledWith(payload);
            expect(result).toEqual(mockResponse);
        });

        it('Debe lanzar NotFoundException si el empleado no existe al crear datos financieros', async () => {
            const payload: CrearDatoFinancieroDto = {
                empleado_id: mockEmpleadoId,
                id_regimen: '018f4a3c-7b2a-7123-8901-0123456789ac',
                cci: '******************2388',
                cuspp: '********CDEF',
                cuenta_bancaria: '191-12345678-0-12',
                sueldo_basico: 2500
            };

            mockAgregarUseCase.execute.mockRejectedValue(new NotFoundException('Empleado no encontrado o ha sido eliminado recientemente.'));
            await expect(controller.crear(payload)).rejects.toThrow(NotFoundException);
        });
    });

    describe('PATCH /api/dato-financiero/empleado/:empleadoId - actualizar', () => {
        it('Debe actualizar datos financieros extrayendo el ID del usuario autenticado del request y pasándolo al UseCase', async () => {
            const payload: ActualizarDatoFinancieroDto = {
                sueldo_basico: 3500,
                password_confirmacion: 'PasswordActual123!'
            };

            const mockRequest = { user: { id: mockUsuarioId } } as FastifyRequest & { user: { id: string } };

            const mockResponse = {
                id: 'df-uuid-1',
                nombre: 'Juan Pérez',
                empleado_id: mockEmpleadoId,
                mensaje: 'Datos financieros actualizados y re-encriptados correctamente.'
            };

            mockEditarUseCase.execute.mockResolvedValue(mockResponse);

            const result = await controller.actualizar(mockEmpleadoId, payload, mockRequest);

            expect(editarDatoFinancieroUseCase.execute).toHaveBeenCalledWith(
                mockEmpleadoId,
                payload,
                mockUsuarioId
            );
            expect(result).toEqual(mockResponse);
        });

        it('Debe lanzar NotFoundException si el dato financiero del empleado no existe al actualizar', async () => {
            const payload: ActualizarDatoFinancieroDto = {
                sueldo_basico: 3500,
                password_confirmacion: 'PasswordActual123!'
            };

            const mockRequest = { user: { id: mockUsuarioId } } as FastifyRequest & { user: { id: string } };

            mockEditarUseCase.execute.mockRejectedValue(new NotFoundException('El dato financiero del empleado no existe o ha sido desactivado.'));
            await expect(controller.actualizar(mockEmpleadoId, payload, mockRequest)).rejects.toThrow(NotFoundException);
        });
    });
});