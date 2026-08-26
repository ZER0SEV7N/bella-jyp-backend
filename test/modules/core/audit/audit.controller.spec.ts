import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from '@/modules/core/audit/controller/audit.controller';
import { ObtenerLogsUseCase } from '@/modules/core/audit/use-cases/obtenerLogs.useCase';
import { RegistroAuditoriaUseCase } from '@/modules/core/audit/use-cases/registroAuditoria.useCase';
import { ObtenerAuditQueryDto, AuditLogDto } from '@jyp/shared-contracts';
import type { FastifyRequest } from 'fastify';

describe('AuditController - Capa HTTP y Mapeo de Parámetros', () => {
    let controller: AuditController;
    let obtenerLogsUseCase: ObtenerLogsUseCase;
    let registroAuditoriaUseCase: RegistroAuditoriaUseCase;

    const mockObtenerLogsUseCase = { execute: jest.fn() };
    const mockRegistroAuditoriaUseCase = { execute: jest.fn() };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuditController],
            providers: [
                { provide: ObtenerLogsUseCase, useValue: mockObtenerLogsUseCase },
                { provide: RegistroAuditoriaUseCase, useValue: mockRegistroAuditoriaUseCase }
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
});