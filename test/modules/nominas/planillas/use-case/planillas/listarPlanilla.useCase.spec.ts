import { ListarPlanillasUseCase } from '@/modules/nomina/planillas/use-case/planillas/listarPlanilla.useCase';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ListarPlanillasUseCase', () => {
    const actor = {
        id: '019a0000-0002-7000-8000-000000000003',
        ip: '127.0.0.1',
    };
    const prisma = {
        historial_planillas: { count: jest.fn(), findMany: jest.fn() },
        $transaction: jest.fn((a) => Promise.all(a)),
    };
    const caso = new ListarPlanillasUseCase(prisma as never);
    it('pagina con una proyección resumida del cálculo', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        prisma.historial_planillas.count.mockResolvedValue(30);
        prisma.historial_planillas.findMany.mockResolvedValue([
            { id: 'p', neto_a_pagar: '1300' },
        ]);
        // Act: ejecutar una única operación del componente.
        const r = await caso.execute({
            periodo: '2026-09',
            page: 2,
            limit: 10,
        });
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(r.meta.total).toBe(30);
        expect(prisma.historial_planillas.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                skip: 10,
                take: 10,
                select: expect.not.objectContaining({ snapshot_calculo: true }),
            })
        );
    });
});
