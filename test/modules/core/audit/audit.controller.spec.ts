import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from '@/modules/core/audit/controller/audit.controller';
import { ObtenerLogsUseCase } from '@/modules/core/audit/use-cases/obtenerLogs.useCase';
import { RegistroAuditoriaUseCase } from '@/modules/core/audit/use-cases/registroAuditoria.useCase';
import { ObtenerHistorialUseCase } from '@/modules/core/audit/use-cases/obtenerHistorial.useCase';
import { ListarActividadUseCase } from '@/modules/core/audit/use-cases/listarActividad.useCase';
import { ObtenerActividadPorIdUseCase } from '@/modules/core/audit/use-cases/obtenerActividadPorId.useCase';
import { ListarLineaTiempoAfectadoUseCase } from '@/modules/core/audit/use-cases/listarLineaTiempoAfectado.useCase';
import { ObtenerAuditQueryDto, AuditLogDto } from '@jyp/shared-contracts';
import type { FastifyRequest } from 'fastify';

describe('AuditController - Capa HTTP y Mapeo de Parámetros', () => {
    let controller: AuditController;
    let obtenerLogsUseCase: ObtenerLogsUseCase;
    let registroAuditoriaUseCase: RegistroAuditoriaUseCase;

    const mockObtenerLogsUseCase = { execute: jest.fn() };
    const mockRegistroAuditoriaUseCase = { execute: jest.fn() };
    const mockObtenerHistorialUseCase = { obtenerHistorialRegistro: jest.fn() };
    const mockListarActividadUseCase = { execute: jest.fn() };
    const mockObtenerActividadPorIdUseCase = { execute: jest.fn() };
    const mockListarLineaTiempoAfectadoUseCase = { execute: jest.fn() };
    const mockRequest = {
        user: { id: 'rrhh-uuid-1', rol: 'RRHH' },
    } as unknown as FastifyRequest & { user: { id: string; rol: string } };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuditController],
            providers: [
                { provide: ObtenerLogsUseCase, useValue: mockObtenerLogsUseCase },
                { provide: RegistroAuditoriaUseCase, useValue: mockRegistroAuditoriaUseCase },
                { provide: ObtenerHistorialUseCase, useValue: mockObtenerHistorialUseCase },
                { provide: ListarActividadUseCase, useValue: mockListarActividadUseCase },
                { provide: ObtenerActividadPorIdUseCase, useValue: mockObtenerActividadPorIdUseCase },
                { provide: ListarLineaTiempoAfectadoUseCase, useValue: mockListarLineaTiempoAfectadoUseCase },
            ]
        }).compile();

        controller = module.get<AuditController>(AuditController);
        obtenerLogsUseCase = module.get<ObtenerLogsUseCase>(ObtenerLogsUseCase);
        registroAuditoriaUseCase = module.get<RegistroAuditoriaUseCase>(RegistroAuditoriaUseCase);

        jest.clearAllMocks();
    });

    describe('GET /api/audit/logs - obtenerLogs', () => {
        it('Debe delegar la consulta de logs al UseCase pasando los queryParams y el usuario autenticado', async () => {
        const queryParams: ObtenerAuditQueryDto = {
            page: 2,
            limit: 25,
            tabla_afectada: 'contratos',
            accion: 'UPDATE',
        };

        const mockRequest = {
            user: { id: 'admin-uuid-1', rol: 'ADMIN' },
        } as unknown as FastifyRequest & { user: { id: string; rol: string } };

        const mockResponse = {
            data: [{ id: 'log-1' }],
            meta: { total: 1, page: 2, limit: 25, totalPages: 1 },
        };

        mockObtenerLogsUseCase.execute.mockResolvedValue(mockResponse);

        const result = await controller.obtenerLogs(queryParams, mockRequest);

        expect(obtenerLogsUseCase.execute).toHaveBeenCalledWith(queryParams, mockRequest.user);
        expect(result).toEqual(mockResponse);
        });
    });

    describe('POST /api/audit/logs - registrarAuditoria', () => {
        it('Debe recibir los datos del log en el body y llamar al RegistroAuditoriaUseCase', async () => {
        const payload: AuditLogDto = {
            accion: 'DOWNLOAD_BOLETA',
            tabla_afectada: 'boletas',
            registro_id: '018f4a3c-7b2a-7123-8901-0123456789ae',
        };

        const mockResponse = {
            id: 'log-uuid-999',
            ...payload,
        };

        mockRegistroAuditoriaUseCase.execute.mockResolvedValue(mockResponse);

        const result = await controller.registrarAuditoria(payload);

        expect(registroAuditoriaUseCase.execute).toHaveBeenCalledWith(payload);
        expect(result).toEqual(mockResponse);
        });
    });
    describe('Vista asistida de actividad', () => {
        it('GET /actividad debe delegar la consulta validada y el usuario autenticado', async () => {
        const query = { page: 1, limit: 50, afectado_tipo: 'empleado' as const };
        const respuesta = { data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0 } };
        mockListarActividadUseCase.execute.mockResolvedValue(respuesta);

        const result = await controller.listarActividad(query, mockRequest);

        expect(mockListarActividadUseCase.execute).toHaveBeenCalledWith(query, mockRequest.user);
        expect(result).toEqual(respuesta);
        });

        it('GET /actividad/:id debe pasar solo el id validado al caso de uso', async () => {
        const id = '018f4a3c-7b2a-7123-8901-0123456789ae';
        mockObtenerActividadPorIdUseCase.execute.mockResolvedValue({ id, cambios: [] });

        const result = await controller.obtenerActividadPorId({ id }, mockRequest);

        expect(mockObtenerActividadPorIdUseCase.execute).toHaveBeenCalledWith(id, mockRequest.user);
        expect(result).toEqual({ id, cambios: [] });
        });

        it('GET /afectados/:tipo/:id debe delegar parámetros, consulta y usuario', async () => {
        const params = { tipo: 'empleado' as const, id: '018f4a3c-7b2a-7123-8901-0123456789ae' };
        const query = { page: 1, limit: 20 };
        mockListarLineaTiempoAfectadoUseCase.execute.mockResolvedValue({ data: [] });

        await controller.listarLineaTiempoAfectado(params, query, mockRequest);

        expect(mockListarLineaTiempoAfectadoUseCase.execute).toHaveBeenCalledWith(params, query, mockRequest.user);
        });
    });
});