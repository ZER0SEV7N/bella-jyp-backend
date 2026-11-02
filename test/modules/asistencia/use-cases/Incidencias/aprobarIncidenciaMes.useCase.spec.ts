import { AprobarIncidenciaMesUseCase } from '@/modules/asistencia/use-cases/Incidencias/aprobarIncidenciaMes.useCase';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('AprobarIncidenciaMesUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const servicio = { aprobarLote: jest.fn() };
  const caso = new AprobarIncidenciaMesUseCase(servicio as never);
  const dto = { periodo: '2026-09', empleado_id: 'empleado' };
  it('conserva el actor y los filtros', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    servicio.aprobarLote.mockResolvedValue({ id: 'trabajo' });
    // Act: ejecutar una única operación del componente.
    const r = await caso.execute(dto as never, actor);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r).toEqual({ id: 'trabajo' });
    expect(servicio.aprobarLote).toHaveBeenCalledWith(
      dto.periodo,
      dto.empleado_id,
      actor
    );
  });
  it('no oculta un rechazo de negocio', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    servicio.aprobarLote.mockRejectedValue(new Error('rechazado'));
    // Act: ejecutar una única operación del componente.
    const r = caso.execute(dto as never, actor);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('rechazado');
  });
});
