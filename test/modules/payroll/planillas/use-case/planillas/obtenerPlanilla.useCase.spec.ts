import { ObtenerPlanillaUseCase } from '@/modules/payroll/planillas/use-case/planillas/obtenerPlanilla.useCase';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ObtenerPlanillaUseCase', () => {
    const actor = {
        id: '019a0000-0002-7000-8000-000000000003',
        ip: '127.0.0.1',
    };
    const prisma = { historial_planillas: { findUnique: jest.fn() } };
    const caso = new ObtenerPlanillaUseCase(prisma as never);
    it('excluye una planilla eliminada', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        prisma.historial_planillas.findUnique.mockResolvedValue(null);
        // Act: ejecutar una única operación del componente.
        const r = caso.execute('planilla');
        // Assert: comprobar resultado, efectos y reglas de negocio.
        await expect(r).rejects.toThrow('no existe');
        expect(prisma.historial_planillas.findUnique).toHaveBeenCalledWith({
            where: { id: 'planilla', deleted_at: null },
        });
    });
    it('entrega el detalle completo', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        prisma.historial_planillas.findUnique.mockResolvedValue({
            snapshot_calculo: { base: '1500' },
        });
        // Act: ejecutar una única operación del componente.
        const r = await caso.execute('planilla');
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(r.snapshot_calculo).toEqual({ base: '1500' });
    });
});
