import Piscina from 'piscina';
import { PayrollPoolService } from '@/workers/calculo-masivo/payroll-pool.service';
jest.mock('piscina', () => ({
    __esModule: true,
    default: jest
        .fn()
        .mockImplementation(() => ({ run: jest.fn(), destroy: jest.fn() })),
}));
describe('PayrollPoolService', () => {
    beforeEach(() => jest.clearAllMocks());
    it('Conserva el error del hilo para decidir el reintento fuera del motor', async () => {
        // Arrange: piscina simulada que falla al ejecutar la entrada.
        const servicio = new PayrollPoolService();
        const piscina = jest.mocked(Piscina).mock.results[0].value;
        const error = new Error('Hilo interrumpido');
        piscina.run.mockRejectedValue(error);
        // Act: enviar datos al adaptador de cálculo.
        const operacion = servicio.calcular({
            empleado_id: 'empleado',
        } as never);
        // Assert: no se informa un monto ni un error de validación inventado.
        await expect(operacion).rejects.toBe(error);
    });
    it('Libera los hilos al cerrar el módulo', async () => {
        // Arrange: instancia con recurso de CPU simulado.
        const servicio = new PayrollPoolService();
        const piscina = jest.mocked(Piscina).mock.results[0].value;
        // Act: ejecutar el apagado del proveedor.
        await servicio.onModuleDestroy();
        // Assert: el apagado no deja workers esperando nuevas tareas.
        expect(piscina.destroy).toHaveBeenCalledTimes(1);
    });
});
