import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ObtenerLogsUseCase } from '@/modules/core/audit/use-cases/obtenerLogs.useCase';
import { ObtenerAuditQueryDto } from '@jyp/shared-contracts';

describe('ObtenerLogsUseCase - Pruebas Unitarias de Query Params y Privacidad', () => {
    let useCase: ObtenerLogsUseCase;
    let prismaService: PrismaService;

    const mockPrismaService = {
        audit_log: {
        count: jest.fn(),
        findMany: jest.fn(),
        },
        $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
        providers: [
            ObtenerLogsUseCase,
            { provide: PrismaService, useValue: mockPrismaService },
        ],
        }).compile();

        useCase = module.get<ObtenerLogsUseCase>(ObtenerLogsUseCase);
        prismaService = module.get<PrismaService>(PrismaService);

        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('execute() - Evaluación Exhaustiva de Query Params y Paginación', () => {
        it('Debe calcular correctamente el skip y la paginación con valores por defecto (page=1, limit=50)', async () => {
        const query: ObtenerAuditQueryDto = {
            page: 1,
            limit: 50,
        };
        const userAdmin = { id: 'admin-uuid-1', rol: 'ADMIN' };

        const mockLogs = [
            { id: 'log-1', accion: 'UPDATE', tabla_afectada: 'empleados' },
            { id: 'log-2', accion: 'CREATE', tabla_afectada: 'contratos' },
        ];

        mockPrismaService.audit_log.count.mockResolvedValue(120);
        mockPrismaService.audit_log.findMany.mockResolvedValue(mockLogs);

        const result = await useCase.execute(query, userAdmin);

        expect(prismaService.audit_log.count).toHaveBeenCalledWith({ where: {} });
        expect(prismaService.audit_log.findMany).toHaveBeenCalledWith({
            where: {},
            skip: 0,
            take: 50,
            orderBy: { created_at: 'desc' },
            include: expect.any(Object),
        });

        expect(result).toEqual({
            data: mockLogs,
            meta: {
            total: 120,
            page: 1,
            limit: 50,
            totalPages: 3, // Math.ceil(120 / 50) = 3
            },
        });
        });

        it('Debe calcular skip de forma precisa cuando se especifica una página mayor (page=3, limit=10)', async () => {
        const query: ObtenerAuditQueryDto = {
            page: 3,
            limit: 10,
        };
        const userAdmin = { id: 'admin-uuid-1', rol: 'ADMIN' };

        mockPrismaService.audit_log.count.mockResolvedValue(25);
        mockPrismaService.audit_log.findMany.mockResolvedValue([]);

        const result = await useCase.execute(query, userAdmin);

        // (3 - 1) * 10 = 20
        expect(prismaService.audit_log.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
            skip: 20,
            take: 10,
            }),
        );
        expect(result.meta.totalPages).toBe(3); // Math.ceil(25 / 10) = 3
        });

        it('Debe aplicar todos los filtros de query params (tabla_afectada, accion, usuario_id, registro_id) para un ADMIN', async () => {
        const query: ObtenerAuditQueryDto = {
            page: 1,
            limit: 20,
            tabla_afectada: 'contratos',
            accion: 'UPDATE',
            usuario_id: 'user-uuid-99',
            registro_id: 'registro-uuid-88',
        };
        const userAdmin = { id: 'admin-uuid-1', rol: 'ADMIN' };

        mockPrismaService.audit_log.count.mockResolvedValue(1);
        mockPrismaService.audit_log.findMany.mockResolvedValue([{ id: 'log-1' }]);

        await useCase.execute(query, userAdmin);

        const expectedWhere = {
            tabla_afectada: 'contratos',
            accion: 'UPDATE',
            usuario_id: 'user-uuid-99',
            registro_id: 'registro-uuid-88',
        };

        expect(prismaService.audit_log.count).toHaveBeenCalledWith({ where: expectedWhere });
        expect(prismaService.audit_log.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expectedWhere }),
        );
        });

        it('Debe filtrar exclusivamente por tabla_afectada cuando solo se proporciona ese query param', async () => {
        const query: ObtenerAuditQueryDto = {
            page: 1,
            limit: 10,
            tabla_afectada: 'historial_planillas',
        };
        const userJyp = { id: 'jyp-uuid-1', rol: 'JYP' };

        mockPrismaService.audit_log.count.mockResolvedValue(5);
        mockPrismaService.audit_log.findMany.mockResolvedValue([]);

        await useCase.execute(query, userJyp);

        expect(prismaService.audit_log.count).toHaveBeenCalledWith({
            where: { tabla_afectada: 'historial_planillas' },
        });
        });

        it('Debe filtrar exclusivamente por la acción ejecutada (ej: DELETE)', async () => {
        const query: ObtenerAuditQueryDto = {
            page: 1,
            limit: 10,
            accion: 'DELETE',
        };
        const userAdmin = { id: 'admin-uuid-1', rol: 'ADMIN' };

        mockPrismaService.audit_log.count.mockResolvedValue(2);
        mockPrismaService.audit_log.findMany.mockResolvedValue([]);

        await useCase.execute(query, userAdmin);

        expect(prismaService.audit_log.count).toHaveBeenCalledWith({
            where: { accion: 'DELETE' },
        });
        });
    });

    describe('execute() - Reglas de Negocio y Privacidad por Rol', () => {
        it('Regla de Negocio CONTADOR: Debe restringir la consulta a sus propios registros o los del rol ASISTENTE', async () => {
        const query: ObtenerAuditQueryDto = {
            page: 1,
            limit: 10,
            tabla_afectada: 'empleados',
        };
        const userContador = { id: 'contador-uuid-123', rol: 'CONTADOR' };

        mockPrismaService.audit_log.count.mockResolvedValue(10);
        mockPrismaService.audit_log.findMany.mockResolvedValue([]);

        await useCase.execute(query, userContador);

        const expectedWhereContador = {
            tabla_afectada: 'empleados',
            usuarios: {
            OR: [
                { id: 'contador-uuid-123' },
                { rol: 'ASISTENTE' },
            ],
            },
        };

        expect(prismaService.audit_log.count).toHaveBeenCalledWith({ where: expectedWhereContador });
        expect(prismaService.audit_log.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expectedWhereContador }),
        );
        });

        it('Regla de Negocio CONTADOR: Debe permitir filtrar por usuario_id manteniendo la cláusula OR de privacidad', async () => {
        const query: ObtenerAuditQueryDto = {
            page: 1,
            limit: 10,
            usuario_id: 'asistente-uuid-456',
        };
        const userContador = { id: 'contador-uuid-123', rol: 'CONTADOR' };

        mockPrismaService.audit_log.count.mockResolvedValue(3);
        mockPrismaService.audit_log.findMany.mockResolvedValue([]);

        await useCase.execute(query, userContador);

        const expectedWhere = {
            usuario_id: 'asistente-uuid-456',
            usuarios: {
            OR: [
                { id: 'contador-uuid-123' },
                { rol: 'ASISTENTE' },
            ],
            },
        };

        expect(prismaService.audit_log.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expectedWhere }),
        );
        });

        it('Excepción / Seguridad: Debe lanzar ForbiddenException si un usuario con rol RRHH intenta consultar los logs', async () => {
        const query: ObtenerAuditQueryDto = { page: 1, limit: 10 };
        const userRRHH = { id: 'rrhh-uuid-1', rol: 'RRHH' };

        await expect(useCase.execute(query, userRRHH)).rejects.toThrow(
            new ForbiddenException('No tiene los privilegios para auditar el sistema.'),
        );
        expect(prismaService.audit_log.count).not.toHaveBeenCalled();
        });

        it('Excepción / Seguridad: Debe rechazar inmediatamente el acceso a un EMPLEADO', async () => {
        const query: ObtenerAuditQueryDto = { page: 1, limit: 10 };
        const userEmpleado = { id: 'emp-uuid-1', rol: 'EMPLEADO' };

        await expect(useCase.execute(query, userEmpleado)).rejects.toThrow(ForbiddenException);
        });
    });
});