import { restar } from '@/modules/asistencia/domain/intervalos-asistencia';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('restar', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };

  it('no descuenta dos veces dos coberturas solapadas', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    const base: [[number, number]] = [[540, 1080]];
    const permisos: [number, number][] = [
      [600, 660],
      [630, 690],
    ];
    // Act: ejecutar una única operación del componente.
    const r = restar(base, permisos);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r).toEqual([
      [540, 600],
      [690, 1080],
    ]);
  });
  it('conserva el intervalo sin cobertura superpuesta', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    const base: [[number, number]] = [[540, 600]];
    // Act: ejecutar una única operación del componente.
    const r = restar(base, [[600, 660]]);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r).toEqual(base);
  });
});
