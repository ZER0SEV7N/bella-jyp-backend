import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ListarTiposAfpUseCase } from '@/modules/payroll/afp/use-cases/tipo-afp/listarTipoAfp.useCase';
import type { ListarTiposAfpQueryDto } from '@jyp/shared-contracts';

describe('ListarTiposAfpUseCase - Pruebas Unitarias de Paginación y Catálogo', () => {
    let useCase: ListarTiposAfpUseCase;

    const mockPrisma = {
        tipo_afp: { count: jest.fn(), findMany: jest.fn()},
        $transaction: jest.fn((queries: Promise<any>[]) => Promise.all(queries))
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ListarTiposAfpUseCase,
                { provide: PrismaService, useValue: mockPrisma }
            ]
        }).compile();

        useCase = module.get<ListarTiposAfpUseCase>(ListarTiposAfpUseCase);
    });

    afterEach(() => jest.clearAllMocks());

    describe('listar() - Paginación y Consulta de Catálogo', () => {
        it('Happy Path: Debe listar los tipos de AFP con paginación por defecto incluyendo el régimen de pensión', async () => {
            const query: ListarTiposAfpQueryDto = { page: 1, limit: 10 };

            const mockAfps = [{
                id: '018f4a7c-5555-7000-e000-000000000001',
                id_regimen: '018f4a7c-4444-7000-d000-000000000002',
                nombre: 'AFP INTEGRA',
                regimen_pension: { nombre: 'SPP (AFP)' },
            },
            {
                id: '018f4a7c-5555-7000-e000-000000000002',
                id_regimen: '018f4a7c-4444-7000-d000-000000000002',
                nombre: 'AFP PRIMA',
                regimen_pension: { nombre: 'SPP (AFP)' },
            }];

            mockPrisma.tipo_afp.count.mockResolvedValueOnce(2);
            mockPrisma.tipo_afp.findMany.mockResolvedValueOnce(mockAfps);

            const result = await useCase.listar(query);

            expect(mockPrisma.tipo_afp.count).toHaveBeenCalled();
            expect(mockPrisma.tipo_afp.findMany).toHaveBeenCalledWith({
                skip: 0,
                take: 10,
                orderBy: { nombre: 'asc' },
                include: { regimen_pension: { select: { nombre: true } } },
            });

            expect(result).toEqual({
                data: mockAfps,
                meta: {total: 2, page: 1, limit: 10, totalPages: 1 }
            });
        });

        it('Happy Path: Debe calcular correctamente el skip y totalPages para páginas intermedias (page: 2, limit: 5)', async () => {
            const query: ListarTiposAfpQueryDto = { page: 2, limit: 5 };

            mockPrisma.tipo_afp.count.mockResolvedValueOnce(12);
            mockPrisma.tipo_afp.findMany.mockResolvedValueOnce([]);

            const result = await useCase.listar(query);

            expect(mockPrisma.tipo_afp.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5 }));
            expect(result.meta).toEqual({total: 12, page: 2, limit: 5, totalPages: 3 });
        });

        it('Happy Path: Debe responder con data vacía y totalPages 0 cuando no hay registros en BD', async () => {
            const query: ListarTiposAfpQueryDto = { page: 1, limit: 10 };

            mockPrisma.tipo_afp.count.mockResolvedValueOnce(0);
            mockPrisma.tipo_afp.findMany.mockResolvedValueOnce([]);

            const result = await useCase.listar(query);

            expect(result.data).toEqual([]);
            expect(result.meta.total).toBe(0);
            expect(result.meta.totalPages).toBe(0);
        });
    });
});