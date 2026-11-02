import { ValidarImportacionMarcacionesUseCase } from '@/modules/asistencia/use-cases/asistencias/validarImportacionMarcaciones.useCase';
import { prepararImportacion } from '@/modules/asistencia/helpers/preparar-importacion.helper';
jest.mock('@/modules/asistencia/helpers/preparar-importacion.helper');
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ValidarImportacionMarcacionesUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const caso = new ValidarImportacionMarcacionesUseCase({} as never);
  it('habilita confirmación solo sin errores', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    jest.mocked(prepararImportacion).mockResolvedValue({
      vista: { errores: [] },
    } as never);
    // Act: ejecutar una única operación del componente.
    const r = await caso.execute({} as never);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r.confirmable).toBe(true);
  });
  it('mantiene los errores de filas', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    jest.mocked(prepararImportacion).mockResolvedValue({
      vista: { errores: [{ fila: 2, detalle: 'Documento inexistente' }] },
    } as never);
    // Act: ejecutar una única operación del componente.
    const r = await caso.execute({} as never);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r.confirmable).toBe(false);
    expect(r.errores).toHaveLength(1);
  });
});
