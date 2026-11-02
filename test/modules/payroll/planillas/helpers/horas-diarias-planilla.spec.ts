import { horasDiariasPlanilla } from '@/modules/payroll/planillas/helpers/preparar-planilla.helper';
import { validarJornadaRegular } from '@/modules/asistencia/domain/validar-jornada';
import {
    contexto,
    entrada,
    horario,
    horario48,
    cambiarMarcas,
    dia,
    solicitud,
} from '../../../../fixtures/motores.fixture';

describe('horas - Reglas aisladas del motor', () => {
    it('La jornada de seis horas aporta seis al divisor de remuneraciones', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        const c = contexto();
        c.jornadas[0].horario = horario.map((d) => ({ ...d, salida: '16:00' }));
        c.jornadas[0].minutos_semana = 1800;
        // Act: ejecutar la regla.
        const resultado1 = validarJornadaRegular(c.jornadas[0].horario, 1800);
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toBe(1800);
        // Act: ejecutar la regla.
        const resultado2 = horasDiariasPlanilla(c);
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado2).toBe('6');
    });

    it('Un cambio de ocho a seis horas dentro del mes requiere liquidación por tramos', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        const c = contexto();
        c.jornadas.push({
            ...c.jornadas[0],
            desde: '2026-09-15',
            horario: horario.map((d) => ({ ...d, salida: '16:00' })),
            minutos_semana: 1800,
        });
        // Act: ejecutar la regla al invocar la función diferida.
        const resultado1 = () => horasDiariasPlanilla(c);
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toThrow(/por tramos/);
    });
});
