import { ImportarMarcacionesUseCase } from '@/modules/asistencia/use-cases/asistencias/importarMarcaciones.useCase';
import { prepararImportacion } from '@/modules/asistencia/helpers/preparar-importacion.helper';
jest.mock('@/modules/asistencia/helpers/preparar-importacion.helper');
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ImportarMarcacionesUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const servicio = { guardar: jest.fn() };
  const caso = new ImportarMarcacionesUseCase({} as never, servicio as never);
  beforeEach(() => jest.clearAllMocks());
  it('guarda un archivo validado y conserva al actor', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    const preparada = { vista: { errores: [] } };
    jest.mocked(prepararImportacion).mockResolvedValue(preparada as never);
    servicio.guardar.mockResolvedValue({ insertadas: 4 });
    // Act: ejecutar una única operación del componente.
    const r = await caso.execute({} as never, actor);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r.insertadas).toBe(4);
    expect(servicio.guardar).toHaveBeenCalledWith(preparada, actor);
  });
  it('no guarda ni una fila si alguna tiene errores', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    jest.mocked(prepararImportacion).mockResolvedValue({
      vista: { errores: [{ fila: 4 }] },
    } as never);
    // Act: ejecutar una única operación del componente.
    const r = caso.execute({} as never, actor);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow();
    expect(servicio.guardar).not.toHaveBeenCalled();
  });
});
