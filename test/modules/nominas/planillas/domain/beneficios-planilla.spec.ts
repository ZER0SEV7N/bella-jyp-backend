import { calcularGratificacion } from '@/modules/nomina/planillas/domain/beneficios-planilla';
import { entrada } from '../../../../fixtures/motores.fixture';
import { Dinero } from '@/modules/nomina/planillas/domain/dinero-planilla';
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('calcularGratificacion', () => {
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
