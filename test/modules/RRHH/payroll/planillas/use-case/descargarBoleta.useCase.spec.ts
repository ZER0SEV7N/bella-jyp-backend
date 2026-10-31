import { DescargarBoletaUseCase } from '@/modules/payroll/planillas/use-case/descargarBoleta.useCase';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('DescargarBoletaUseCase', () => {
    const actor = {
        id: '019a0000-0002-7000-8000-000000000003',
        ip: '127.0.0.1',
    };
    const obtener = { execute: jest.fn() },
        archivos = { boleta: jest.fn() };
    const caso = new DescargarBoletaUseCase(
        obtener as never,
        archivos as never
    );
    beforeEach(() => jest.clearAllMocks());
    it('entrega el PDF archivado tras cerrar', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        obtener.execute.mockResolvedValue({
            estado: 'CONGELADO',
            snapshot_calculo: {},
        });
        archivos.boleta.mockResolvedValue({ nombre: 'boleta.pdf' });
        // Act: ejecutar una única operación del componente.
        const r = await caso.execute('planilla');
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(r.nombre).toBe('boleta.pdf');
        expect(archivos.boleta).toHaveBeenCalledWith('planilla');
    });
    it('no genera una boleta definitiva desde un borrador', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        obtener.execute.mockResolvedValue({
            estado: 'ABIERTO',
            snapshot_calculo: {},
        });
        // Act: ejecutar una única operación del componente.
        const r = caso.execute('planilla');
        // Assert: comprobar resultado, efectos y reglas de negocio.
        await expect(r).rejects.toThrow('validada');
        expect(archivos.boleta).not.toHaveBeenCalled();
    });
});
