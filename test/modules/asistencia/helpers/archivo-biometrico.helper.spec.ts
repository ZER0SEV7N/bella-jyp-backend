import { conArchivoBiometrico } from '@/modules/asistencia/helpers/archivo-biometrico.helper';
import { Open } from 'unzipper';
import { Readable } from 'node:stream';
import { access } from 'node:fs/promises';
import { createHash } from 'node:crypto';

jest.mock('unzipper', () => ({ Open: { file: jest.fn() } }));
describe('Archivo biométrico temporal', () => {
  const abrir = jest.mocked(Open.file);
  const archivo = (
    bytes = Buffer.from('contenido simulado'),
    truncated = false
  ) =>
    ({ file: Object.assign(Readable.from([bytes]), { truncated }) }) as never;
  const libro = (xml = '<workbook/>', size = 100) => ({
    path: 'xl/workbook.xml',
    uncompressedSize: size,
    buffer: jest.fn().mockResolvedValue(Buffer.from(xml)),
  });
  beforeEach(() => {
    jest.resetAllMocks();
    abrir.mockResolvedValue({ files: [libro()] } as never);
  });
  it.each([
    ['<workbook/>', false],
    ['<workbook date1904="1"/>', true],
    ['<workbook date1904="true"/>', true],
  ])(
    'detecta el sistema de fechas de %s y elimina el temporal',
    async (xml, esperado) => {
      // Arrange: el ZIP se simula; el stream permite comprobar hash y limpieza del temporal.
      const bytes = Buffer.from('contenido simulado');
      abrir.mockResolvedValue({ files: [libro(String(xml))] } as never);
      const leer = jest.fn(
        async (ruta: string, usa1904: boolean, hash: string) => {
          await access(ruta);
          return { usa1904, hash };
        }
      );
      // Act: procesar el archivo y devolver el resultado de la lectura.
      const resultado = await conArchivoBiometrico(archivo(bytes), leer);
      // Assert: usar el hash real de los bytes y borrar el archivo después de leerlo.
      expect(resultado).toEqual({
        usa1904: esperado,
        hash: createHash('sha256').update(bytes).digest('hex'),
      });
      await expect(access(leer.mock.calls[0][0])).rejects.toMatchObject({
        code: 'ENOENT',
      });
    }
  );
  it.each([
    ['demasiados bytes', 2 * 1024 * 1024 + 1, false],
    ['stream truncado', 10, true],
  ])(
    'rechaza %s antes de abrir el ZIP',
    async (_nombre, cantidad, truncado) => {
      // Arrange: límite de bytes y señal de truncamiento se comprueban por separado.
      const leer = jest.fn();
      // Act: intentar almacenar un archivo incompleto o excesivo.
      const resultado = conArchivoBiometrico(
        archivo(Buffer.alloc(Number(cantidad)), Boolean(truncado)),
        leer
      );
      // Assert: no leer contenido que ya superó el límite permitido.
      await expect(resultado).rejects.toMatchObject({ status: 400 });
      expect(abrir).not.toHaveBeenCalled();
      expect(leer).not.toHaveBeenCalled();
    }
  );
  it.each([
    ['129 entradas', Array.from({ length: 129 }, () => libro())],
    ['más de 20 MB descomprimidos', [libro('', 20 * 1024 * 1024 + 1)]],
    ['sin workbook.xml', []],
    ['workbook.xml mayor de 64 KB', [libro('', 65537)]],
  ])(
    'rechaza un contenedor con %s y limpia su temporal',
    async (_nombre, files) => {
      // Arrange: simular solo la estructura ZIP, sin crear archivos de gran tamaño.
      abrir.mockResolvedValue({ files } as never);
      const leer = jest.fn();
      // Act: validar el contenedor antes de procesar sus filas.
      const resultado = conArchivoBiometrico(archivo(), leer);
      // Assert: la lectura no debe ejecutarse y el temporal debe desaparecer.
      await expect(resultado).rejects.toMatchObject({ status: 400 });
      expect(leer).not.toHaveBeenCalled();
      await expect(
        access(String(abrir.mock.calls[0][0]))
      ).rejects.toMatchObject({ code: 'ENOENT' });
    }
  );
  it('convierte un error ZIP en un error de entrada comprensible', async () => {
    // Arrange: el contenedor tiene una firma inválida.
    abrir.mockRejectedValue(new Error('invalid signature'));
    // Act: abrir el archivo enviado por el usuario.
    const resultado = conArchivoBiometrico(archivo(), jest.fn());
    // Assert: no exponer al usuario el detalle interno de unzipper.
    await expect(resultado).rejects.toThrow('Excel XLSX válido');
  });
  it('conserva el error del lector y limpia aun cuando falla el procesamiento', async () => {
    // Arrange: la validación ZIP pasa, pero falla el procesamiento posterior.
    const error = new Error('falló la lectura de filas');
    const leer = jest.fn().mockRejectedValue(error);
    // Act: ejecutar la operación que falla después de guardar el archivo.
    const resultado = conArchivoBiometrico(archivo(), leer);
    // Assert: propagar el error original y eliminar el temporal en finally.
    await expect(resultado).rejects.toBe(error);
    await expect(access(leer.mock.calls[0][0])).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
