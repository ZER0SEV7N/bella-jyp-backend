import { ImportacionAsistenciaController } from '@/modules/asistencia/controller/importacion-asistencia.controller';
describe('ImportacionAsistenciaController', () => {
  const validar = { execute: jest.fn() },
    importar = { execute: jest.fn() };
  const controller = new ImportacionAsistenciaController(
    validar as never,
    importar as never
  );
  beforeEach(() => jest.clearAllMocks());
  it('Valida el archivo recibido sin confirmar escrituras', async () => {
    // Arrange: archivo multipart simulado y una vista previa sin errores.
    const archivo = { filename: 'marcaciones.xlsx' };
    const req = { file: jest.fn().mockResolvedValue(archivo) };
    validar.execute.mockResolvedValue({ confirmable: true });
    // Act: solicitar la vista previa.
    const r = await controller.validar(req as never);
    // Assert: solo se invoca validación, con el límite de dos MB del endpoint.
    expect(r.confirmable).toBe(true);
    expect(validar.execute).toHaveBeenCalledWith(archivo);
    expect(importar.execute).not.toHaveBeenCalled();
    expect(req.file).toHaveBeenCalledWith({
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    });
  });
  it('Confirma el archivo con el actor de la sesión', async () => {
    // Arrange: archivo validable y usuario autenticado por la guardia HTTP.
    const archivo = { filename: 'marcaciones.xlsx' };
    const req = {
      file: jest.fn().mockResolvedValue(archivo),
      user: { id: 'usuario', rol: 'RRHH' },
      ip: '127.0.0.1',
    };
    importar.execute.mockResolvedValue({ insertadas: 4 });
    // Act: confirmar la importación.
    const r = await controller.importar(req as never);
    // Assert: el importador recibe el responsable; no se confía en un actor enviado en el cuerpo.
    expect(r.insertadas).toBe(4);
    expect(importar.execute).toHaveBeenCalledWith(archivo, {
      id: 'usuario',
      ip: '127.0.0.1',
    });
  });
  it('Rechaza una petición sin archivo', async () => {
    // Arrange: petición multipart vacía.
    const req = { file: jest.fn().mockResolvedValue(undefined) };
    // Act: solicitar la validación sin adjuntar el Excel.
    const r = controller.validar(req as never);
    // Assert: error explícito antes de llamar al caso de uso.
    await expect(r).rejects.toThrow('Adjunte');
    expect(validar.execute).not.toHaveBeenCalled();
  });
});
