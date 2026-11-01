import { calcularPlanilla } from '@/modules/payroll/planillas/domain/calcular-planilla';
import {
    contexto,
    entrada,
    horario,
    horario48,
    cambiarMarcas,
    dia,
    solicitud,
} from '../../../../fixtures/motores.fixture';

describe('planilla - Reglas aisladas del motor', () => {
    it('Planilla ONP: un sueldo de 1500 da un neto de 1305 sin otros conceptos', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        // Act: calcular con las entradas preparadas.
        const r = calcularPlanilla(entrada());
        // Act: ejecutar la regla.
        const resultado1 = r.descuento_onp;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toBe('195.0000');
        // Act: ejecutar la regla.
        const resultado2 = r.neto_a_pagar;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado2).toBe('1305.0000');
    });

    it('La falta se descuenta una sola vez', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        const e = entrada();
        e.faltas = 1;
        e.dias_remunerables = 29;
        e.descuento_dso = '0';
        // Act: calcular con las entradas preparadas.
        const r = calcularPlanilla(e);
        // Act: ejecutar la regla.
        const resultado1 = r.descuento_faltas;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toBe('50.0000');
        // Act: ejecutar la regla.
        const resultado2 = r.descuento_onp;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado2).toBe('188.5000');
        // Act: ejecutar la regla.
        const resultado3 = r.neto_a_pagar;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado3).toBe('1261.5000');
    });

    it('El sueldo se proporciona a los días del vínculo', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        const e = entrada();
        e.dias_vinculo = 15;
        e.dias_remunerables = 15;
        // Act: ejecutar la regla.
        const resultado1 = calcularPlanilla(e).sueldo_base;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toBe('750.0000');
    });

    it('Los minutos de sobretiempo no se redondean antes del importe', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        const e = entrada();
        e.minutos_extras_25 = 14;
        // Act: ejecutar la regla.
        const resultado1 = calcularPlanilla(e).horas_extras_25;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toBe('1.8229');
    });

    it('La prima AFP respeta el tope asegurable y la comisión mixta no usa el saldo anual', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        const e = entrada();
        e.regimen = 'AFP';
        e.tipo_comision = 'MIXTA';
        e.afp = {
            aporte: '10',
            prima: '1.37',
            flujo: '1.69',
            flujo_mixta: '0',
            tope_seguro: '1000',
        };
        // Act: calcular con las entradas preparadas.
        const r = calcularPlanilla(e);
        // Act: ejecutar la regla.
        const resultado1 = r.descuento_afp_fondo;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toBe('150.0000');
        // Act: ejecutar la regla.
        const resultado2 = r.descuento_afp_seguro;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado2).toBe('13.7000');
        // Act: ejecutar la regla.
        const resultado3 = r.descuento_afp_comision;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado3).toBe('0.0000');
    });

    it('La comisión mixta sin componente configurado falla explícitamente', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        const e = entrada();
        e.regimen = 'AFP';
        e.tipo_comision = 'MIXTA';
        e.afp = {
            aporte: '10',
            prima: '1.37',
            flujo: '1.69',
            flujo_mixta: null,
            tope_seguro: '12000',
        };
        // Act: ejecutar la regla al invocar la función diferida.
        const resultado1 = () => calcularPlanilla(e);
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toThrow(/componente/);
    });

    it('Un resultado imposible no se guarda como neto negativo', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        const e = entrada();
        e.adelantos_desembolsados = '5000';
        // Act: ejecutar la regla al invocar la función diferida.
        const resultado1 = () => calcularPlanilla(e);
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toThrow(/negativo/);
    });

    it('El ausentismo exige una determinación contable del descanso semanal', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        const e = entrada();
        e.faltas = 1;
        e.dias_remunerables = 29;
        // Act: ejecutar la regla al invocar la función diferida.
        const resultado1 = () => calcularPlanilla(e);
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toThrow(/descanso semanal/);
    });

    it('El descanso semanal aprobado se descuenta una sola vez y reduce la base previsional', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        const e = entrada();
        e.faltas = 1;
        e.dias_remunerables = 29;
        e.descuento_dso = '10';
        // Act: calcular con las entradas preparadas.
        const r = calcularPlanilla(e);
        // Act: ejecutar la regla.
        const resultado1 = r.descuento_dso;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toBe('10.0000');
        // Act: ejecutar la regla.
        const resultado2 = r.descuento_onp;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado2).toBe('187.2000');
        // Act: ejecutar la regla.
        const resultado3 = r.neto_a_pagar;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado3).toBe('1252.8000');
    });

    it('El bono extraordinario aprobado integra la base previsional sin proyectarse cada mes', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        const e = entrada();
        e.bono_extraordinario = '100';
        // Act: calcular con las entradas preparadas.
        const r = calcularPlanilla(e);
        // Act: ejecutar la regla.
        const resultado1 = r.descuento_onp;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toBe('208.0000');
        // Act: ejecutar la regla.
        const resultado2 = r.neto_a_pagar;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado2).toBe('1392.0000');
    });

    it('El descuento autorizado no reduce la base pensionable', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        const e = entrada();
        e.descuento_autorizado = '50';
        // Act: calcular con las entradas preparadas.
        const r = calcularPlanilla(e);
        // Act: ejecutar la regla.
        const resultado1 = r.descuento_onp;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toBe('195.0000');
        // Act: ejecutar la regla.
        const resultado2 = r.neto_a_pagar;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado2).toBe('1255.0000');
    });
});
