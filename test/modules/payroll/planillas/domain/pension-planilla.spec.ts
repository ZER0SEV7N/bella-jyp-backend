import { calcularPension } from '@/modules/payroll/planillas/domain/pension-planilla';
import { entrada } from '../../../../fixtures/motores.fixture';
import { Dinero } from '@/modules/payroll/planillas/domain/dinero-planilla';
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('calcularPension', () => {
    const actor = {
        id: '019a0000-0002-7000-8000-000000000003',
        ip: '127.0.0.1',
    };
    const parametros = Object.fromEntries(
        Object.entries(entrada().parametros).map(([k, v]) => [k, new Dinero(v)])
    ) as never;
    it('calcula ONP usando la fracción configurada', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        const e = entrada();
        // Act: ejecutar una única operación del componente.
        const r = calcularPension(e, new Dinero(1500), parametros);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(r.onp.toString()).toBe('195');
        expect(r.fondo.isZero()).toBe(true);
    });
    it('aplica el tope al seguro AFP sin limitar el fondo obligatorio', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        const e = {
            ...entrada(),
            regimen: 'AFP' as const,
            tipo_comision: 'FLUJO' as const,
            afp: {
                aporte: '10',
                prima: '1.37',
                flujo: '1.55',
                flujo_mixta: '0',
                tope_seguro: '1000',
            },
        };
        // Act: ejecutar una única operación del componente.
        const r = calcularPension(e, new Dinero(1500), parametros);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(r.fondo.toString()).toBe('150');
        expect(r.seguro.toString()).toBe('13.7');
        expect(r.comision.toString()).toBe('23.25');
    });
});
