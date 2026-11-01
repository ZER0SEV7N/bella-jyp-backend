import { calcularGratificacion } from '@/modules/payroll/planillas/domain/beneficios-planilla';
import { entrada } from '../../../../fixtures/motores.fixture';
import { Dinero } from '@/modules/payroll/planillas/domain/dinero-planilla';
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('calcularGratificacion', () => {
    const actor = {
        id: '019a0000-0002-7000-8000-000000000003',
        ip: '127.0.0.1',
    };

    it('prorratea tres meses computables en julio', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        const e = { ...entrada(), meses_gratificacion: 3 };
        // Act: ejecutar una única operación del componente.
        const r = calcularGratificacion(e, 7, new Dinero(1500), new Dinero(0));
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(r.gratificacion.toString()).toBe('750');
        expect(r.bonificacion.toString()).toBe('67.5');
    });
    it('no adelanta la gratificación a septiembre', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        const e = { ...entrada(), meses_gratificacion: 3 };
        // Act: ejecutar una única operación del componente.
        const r = calcularGratificacion(e, 9, new Dinero(1500), new Dinero(0));
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(r.gratificacion.isZero()).toBe(true);
    });
});
