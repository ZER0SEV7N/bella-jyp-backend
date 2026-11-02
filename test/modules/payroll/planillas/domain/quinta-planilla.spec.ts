import { corteRetencionesQuinta } from '@/modules/payroll/planillas/domain/calcular-planilla';
import {
    contexto,
    entrada,
    horario,
    horario48,
    cambiarMarcas,
    dia,
    solicitud,
} from '../../../../fixtures/motores.fixture';

describe('quinta - Reglas aisladas del motor', () => {
    it('Los cortes de quinta categoría son los del tramo y no cambian cada mes', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        // Act: ejecutar la regla.
        const resultado1 = corteRetencionesQuinta(6);
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toEqual({ hastaMes: 4, divisor: 8 });
        // Act: ejecutar la regla.
        const resultado2 = corteRetencionesQuinta(10);
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado2).toEqual({ hastaMes: 8, divisor: 4 });
    });
});
