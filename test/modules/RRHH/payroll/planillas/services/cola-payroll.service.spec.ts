import { ColaPayrollService } from '@/modules/payroll/planillas/services/cola-payroll.service';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ColaPayrollService', () => {
    const actor = {
        id: '019a0000-0002-7000-8000-000000000003',
        ip: '127.0.0.1',
    };
    const cola = { getJob: jest.fn(), add: jest.fn() };
    const caso = new ColaPayrollService(cola as never);
    const dto = {
        periodo: '2026-09',
        solicitud_id: '019a0000-0000-7000-8000-000000000001',
    };
    beforeEach(() => jest.clearAllMocks());
    it('rechaza una idempotencia usada con filtros diferentes', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        cola.getJob.mockResolvedValue({
            data: { dto: { ...dto, empleado_id: 'otro' } },
        });
        // Act: ejecutar una única operación del componente.
        const r = caso.encolar(dto, actor);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        await expect(r).rejects.toThrow('otros filtros');
        expect(cola.add).not.toHaveBeenCalled();
    });
    it('no expone un job a un asistente ajeno', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        cola.getJob.mockResolvedValue({ data: { actor: { id: 'otro' } } });
        // Act: ejecutar una única operación del componente.
        const r = caso.consultar('job', actor, 'ASISTENTE');
        // Assert: comprobar resultado, efectos y reglas de negocio.
        await expect(r).rejects.toThrow('acceso');
    });
    it('el contador consulta el estado real de un job', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        cola.getJob.mockResolvedValue({
            data: { actor: { id: 'otro' } },
            getState: jest.fn().mockResolvedValue('completed'),
            progress: 100,
            returnvalue: { correctos: 10 },
        });
        // Act: ejecutar una única operación del componente.
        const r = await caso.consultar('job', actor, 'CONTADOR');
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(r.estado).toBe('completed');
        expect(r.resultado).toEqual({ correctos: 10 });
    });
});
