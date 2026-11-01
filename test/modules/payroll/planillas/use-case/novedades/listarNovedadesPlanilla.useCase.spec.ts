import { ListarNovedadesPlanillaUseCase } from '@/modules/payroll/planillas/use-case/novedades/listarNovedadesPlanilla.useCase';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ListarNovedadesPlanillaUseCase', () => {
    const actor = {
        id: '019a0000-0002-7000-8000-000000000003',
        ip: '127.0.0.1',
    };
    const prisma = { novedad_planilla: { findMany: jest.fn() } };
    const caso = new ListarNovedadesPlanillaUseCase(prisma as never);
    it('acota el listado al empleado y período', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        prisma.novedad_planilla.findMany.mockResolvedValue([{ id: 'n' }]);
        // Act: ejecutar una única operación del componente.
        const r = await caso.execute('e', '2026-09');
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(r).toEqual([{ id: 'n' }]);
        expect(prisma.novedad_planilla.findMany).toHaveBeenCalledWith({
            where: { empleado_id: 'e', periodo: '2026-09' },
            orderBy: { created_at: 'asc' },
            take: 100,
        });
    });
});
