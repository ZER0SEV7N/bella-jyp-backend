import { GenerarPlanillaUseCase } from '@/modules/nomina/planillas/use-case/planillas/generarPlanilla.useCase';
import { prepararPlanilla } from '@/modules/nomina/planillas/helpers/preparar-planilla.helper';
jest.mock('@/common/utils/transaccion-auditada.util', () => ({
    transaccionAuditada: jest.fn((p, _a, fn) => fn(p)),
    bloquearEmpleado: jest.fn(),
}));
jest.mock('@/modules/payroll/planillas/helpers/preparar-planilla.helper');
describe('GenerarPlanillaUseCase', () => {
    const prisma = {
            historial_planillas: { findUnique: jest.fn(), upsert: jest.fn() },
        },
        pool = { calcular: jest.fn() };
    const caso = new GenerarPlanillaUseCase(prisma as never, pool as never);
    const actor = { id: 'contador', ip: '127.0.0.1' };
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('rechaza las fuentes modificadas durante el trabajo de CPU', async () => {
        // Arrange: capturas con huellas distintas antes y después del cálculo.
        jest.mocked(prepararPlanilla)
            .mockResolvedValueOnce({ hash: 'a', entrada: {} } as never)
            .mockResolvedValueOnce({ hash: 'b' } as never);
        pool.calcular.mockResolvedValue({ neto_a_pagar: '1500' });
        // Act: solicitar el cálculo con la transacción auditada simulada.
        const r = caso.execute('empleado', '2026-09', actor);
        // Assert: los importes obsoletos no se guardan.
        await expect(r).rejects.toThrow('fuentes cambiaron');
        expect(prisma.historial_planillas.upsert).not.toHaveBeenCalled();
    });
    it('un error técnico del hilo se conserva para reintento de BullMQ', async () => {
        // Arrange: preparación válida y una falla técnica del worker.
        jest.mocked(prepararPlanilla).mockResolvedValue({
            hash: 'a',
            entrada: {},
        } as never);
        const error = new Error('Worker desconectado');
        pool.calcular.mockRejectedValue(error);
        // Act: generar la planilla.
        const r = caso.execute('empleado', '2026-09', actor);
        // Assert: no convertir una falla técnica en error de datos del colaborador.
        await expect(r).rejects.toBe(error);
    });
});
