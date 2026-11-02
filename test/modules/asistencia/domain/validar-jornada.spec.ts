import { validarJornadaRegular } from '@/modules/asistencia/domain/validar-jornada';
import {
  contexto,
  entrada,
  horario,
  horario48,
  cambiarMarcas,
  dia,
  solicitud,
} from '../../../fixtures/motores.fixture';

describe('jornada - Reglas aisladas del motor', () => {
  it('Lunes a sábado de ocho horas suma 2880 minutos ordinarios', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    // Act: ejecutar la regla.
    const resultado1 = validarJornadaRegular(horario48(), 2880);
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(2880);
  });

  it('Una jornada de cuarenta horas sigue siendo válida', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    // Act: ejecutar la regla.
    const resultado1 = validarJornadaRegular(horario, 2400);
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(2400);
  });

  it('No se acepta declarar cuarenta horas para un horario real de cuarenta y ocho', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    // Act: ejecutar la regla al invocar la función diferida.
    const resultado1 = () => validarJornadaRegular(horario48(), 2400);
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toThrow(/coincidir/);
  });

  it('Siete días laborables se rechazan por falta de descanso semanal', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    // Act: ejecutar la regla al invocar la función diferida.
    const resultado1 = () =>
      validarJornadaRegular(
        horario.map((d) => ({ ...d, laborable: true })),
        3360
      );
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toThrow();
  });

  it('Nueve horas diarias se rechazan en el alcance ordinario', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    // Act: ejecutar la regla al invocar la función diferida.
    const resultado1 = () =>
      validarJornadaRegular(
        horario.map((d) => ({ ...d, salida: '19:00' })),
        2700
      );
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toThrow();
  });

  it('Un refrigerio de treinta minutos no cumple la configuración regular', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    // Act: ejecutar la regla al invocar la función diferida.
    const resultado1 = () =>
      validarJornadaRegular(
        horario.map((d) => ({ ...d, fin_descanso: '13:30' })),
        2550
      );
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toThrow(/45 minutos/);
  });

  it('Un día duplicado o desconocido no representa una semana válida', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    // Act: ejecutar la regla al invocar la función diferida.
    const resultado1 = () =>
      validarJornadaRegular(
        horario.map((d) => ({ ...d, dia: 'LUNES' })),
        2400
      );
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toThrow();
  });

  it('Una semana de pocos días no se trata como un contrato regular de cinco o seis días', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const semana = horario.map((d) => ({
      ...d,
      laborable: d.dia === 'LUNES',
    }));
    // Act: ejecutar la regla al invocar la función diferida.
    const resultado1 = () => validarJornadaRegular(semana, 480);
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toThrow(/cinco o seis/);
  });
});
