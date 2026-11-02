import { feriadosNacionalesPeru } from '@/modules/asistencia/domain/calendario-peru';
import {
  contexto,
  entrada,
  horario,
  horario48,
  cambiarMarcas,
  dia,
  solicitud,
} from '../../../fixtures/motores.fixture';

describe('calendario - Reglas aisladas del motor', () => {
  it('El calendario distingue las incorporaciones legales históricas', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    // Act: ejecutar la regla.
    const resultado1 = feriadosNacionalesPeru(2026).length;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(16);
    // Act: ejecutar la regla.
    const resultado2 = feriadosNacionalesPeru(2020).length;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado2).toBe(12);
    // Act: ejecutar la regla.
    const resultado3 = feriadosNacionalesPeru(2026).some(
      (f) => f.fecha === '2026-04-02'
    );
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado3).toBeTruthy();
    // Act: ejecutar la regla.
    const resultado4 = feriadosNacionalesPeru(2026).some(
      (f) => f.fecha === '2026-04-03'
    );
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado4).toBeTruthy();
  });
});
