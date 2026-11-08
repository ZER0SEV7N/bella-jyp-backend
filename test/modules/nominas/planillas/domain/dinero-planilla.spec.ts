import { decimal } from '@/modules/nomina/planillas/domain/dinero-planilla';
import { r4 } from '@/modules/nomina/planillas/domain/dinero-planilla';
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('decimal', () => {
    const actor = {
        id: '019a0000-0002-7000-8000-000000000003',
        ip: '127.0.0.1',
    };

    it('conserva precisión decimal al sumar importes', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        const a = decimal('0.10'),
            b = decimal('0.20');
        // Act: ejecutar una única operación del componente.
        const r = a.add(b);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(r.toString()).toBe('0.3');
        expect(r4(r)).toBe('0.3000');
    });
    it('rechaza una cantidad negativa', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        const valor = '-0.01';
        // Act: ejecutar una única operación del componente.
        const operar = () => decimal(valor);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(operar).toThrow('no negativos');
    });
    it('no permite desbordar NUMERIC doce cuatro', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        const valor = decimal('99999999.99999');
        // Act: ejecutar una única operación del componente.
        const operar = () => r4(valor);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(operar).toThrow('NUMERIC');
    });
});
