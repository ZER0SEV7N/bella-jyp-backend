import { CongelarPlanillaUseCase } from '@/modules/payroll/planillas/use-case/planillas/congelarPlanilla.useCase';
import { prepararPlanilla } from '@/modules/payroll/planillas/helpers/preparar-planilla.helper';
jest.mock('@/common/utils/transaccion-auditada.util', () => ({
    transaccionAuditada: jest.fn((p, _a, fn) => fn(p)),
    bloquearEmpleado: jest.fn(),
}));
jest.mock('@/modules/payroll/planillas/helpers/preparar-planilla.helper');
describe('CongelarPlanillaUseCase: cierre y bandeja de salida', () => {
    const prisma = {
            historial_planillas: { findUnique: jest.fn(), update: jest.fn() },
        },
        pool = { calcular: jest.fn() },
        n8n = { crearEnTransaccion: jest.fn() };
    const caso = new CongelarPlanillaUseCase(
        prisma as never,
        pool as never,
        n8n as never
    );
    const actor = { id: 'contador', ip: '127.0.0.1' };
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.historial_planillas.findUnique.mockResolvedValue({
            id: 'planilla',
            empleado_id: 'empleado',
            periodo: '2026-09',
            version: 1,
            fuente_hash: 'hash',
            snapshot_calculo: {},
            neto_a_pagar: '1000',
        });
        jest.mocked(prepararPlanilla).mockResolvedValue({
            hash: 'hash',
            entrada: {},
            empresa: {
                nombreEmpresa: 'DEMO',
                ruc: '20000000001',
                direccion: 'Domicilio ficticio',
            },
        } as never);
        pool.calcular.mockResolvedValue({
            version_motor: 'version',
            neto_a_pagar: '1000',
        });
        prisma.historial_planillas.update.mockResolvedValue({
            id: 'planilla',
            periodo: '2026-09',
            version: 2,
        });
        n8n.crearEnTransaccion.mockResolvedValue({ id: 'trabajo' });
    });
    it('registra la boleta dentro de la misma transacción del cierre', async () => {
        // Arrange: planilla conciliada, versión vigente y empresa configurada en los mocks.
        const dto = { version: 1, motivo: 'Revisado por contador' };
        // Act: cerrar la planilla.
        const r = await caso.execute('planilla', dto, actor);
        // Assert: la misma referencia tx crea la intención de emisión; no hay llamada HTTP desde el cierre.
        expect(n8n.crearEnTransaccion).toHaveBeenCalledWith(
            prisma,
            'boleta:planilla:2',
            'BOLETAS',
            '2026-09',
            actor.id,
            ['planilla'],
            { automatico: true }
        );
        expect(r.trabajo_boleta_id).toBe('trabajo');
    });
    it('no crea archivos ni trabajos si cambió la fuente del cálculo', async () => {
        // Arrange: una incidencia o parámetro ya cambió la huella.
        jest.mocked(prepararPlanilla).mockResolvedValue({
            hash: 'otra',
        } as never);
        // Act: intentar cerrar usando el cálculo anterior.
        const r = caso.execute(
            'planilla',
            { version: 1, motivo: 'Prueba de concurrencia' },
            actor
        );
        // Assert: se debe regenerar; no se confirma el cierre.
        await expect(r).rejects.toThrow('regenerarse');
        expect(prisma.historial_planillas.update).not.toHaveBeenCalled();
        expect(n8n.crearEnTransaccion).not.toHaveBeenCalled();
    });
    it('propaga el fallo de la bandeja para que la transacción revierta', async () => {
        // Arrange: la persistencia del trabajo falla antes del commit.
        n8n.crearEnTransaccion.mockRejectedValue(
            new Error('No se pudo persistir')
        );
        // Act: cerrar con una dependencia de persistencia fallida.
        const r = caso.execute(
            'planilla',
            { version: 1, motivo: 'Prueba atómica' },
            actor
        );
        // Assert: no se presenta un cierre exitoso. La reversión real se comprueba con PostgreSQL en integración.
        await expect(r).rejects.toThrow('No se pudo persistir');
    });
});
