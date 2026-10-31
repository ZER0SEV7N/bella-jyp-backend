import { ConsultarTrabajoPlanillasUseCase } from '@/modules/payroll/planillas/use-case/planillas/consultarJobPlanillas.useCase';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ConsultarTrabajoPlanillasUseCase', () => {
    const actor = {
        id: '019a0000-0002-7000-8000-000000000003',
        ip: '127.0.0.1',
    };
    const servicio = { consultar: jest.fn() };
    const caso = new ConsultarTrabajoPlanillasUseCase(servicio as never);
    const dto = { periodo: '2026-09', empleado_id: 'empleado' };
    it('conserva el actor y los filtros', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        servicio.consultar.mockResolvedValue({ id: 'trabajo' });
        // Act: ejecutar una única operación del componente.
        const r = await caso.execute('trabajo', actor, 'CONTADOR');
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(r).toEqual({ id: 'trabajo' });
        expect(servicio.consultar).toHaveBeenCalledWith(
            'trabajo',
            actor,
            'CONTADOR'
        );
    });
    it('no oculta un rechazo de negocio', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        servicio.consultar.mockRejectedValue(new Error('rechazado'));
        // Act: ejecutar una única operación del componente.
        const r = caso.execute('trabajo', actor, 'CONTADOR');
        // Assert: comprobar resultado, efectos y reglas de negocio.
        await expect(r).rejects.toThrow('rechazado');
    });
});
