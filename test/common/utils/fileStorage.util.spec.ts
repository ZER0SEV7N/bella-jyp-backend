//test/common/utils/fileStorage.util.spec.ts
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { FileStorageUtil } from '@/common/utils/fileStorage.util';
import fs from 'node:fs/promises';
import { Readable, Writable } from 'node:stream';

jest.mock('node:fs/promises', () => ({
  __esModule: true,
  default: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    open: jest.fn(),
    rm: jest.fn().mockResolvedValue(undefined),
  },
  mkdir: jest.fn().mockResolvedValue(undefined),
  open: jest.fn(),
  rm: jest.fn().mockResolvedValue(undefined),
}));

/**
 * Pruebas unitarias para FileStorageUtil siguiendo el patrón AAA (Arrange, Act, Assert).
 */
describe('FileStorageUtil - Pruebas Unitarias de Almacenamiento de Archivos', () => {
  const crearMockHandle = () => ({
    createWriteStream: jest.fn(() =>
      new Writable({
        write(_chunk, _enc, cb) {
          cb();
        },
      }),
    ),
    close: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.open as jest.Mock).mockResolvedValue(crearMockHandle());
  });

  describe('guardarArchivoMultipart() - Validaciones de Entrada', () => {
    it('Debe lanzar BadRequestException si el objeto de archivo es null o undefined', async () => {
      // Arrange & Act & Assert
      await expect(FileStorageUtil.guardarArchivoMultipart(null as any, 'contratos')).rejects.toThrow(
        new BadRequestException('No se adjuntó ningún archivo.'),
      );
      await expect(FileStorageUtil.guardarArchivoMultipart(undefined as any, 'contratos')).rejects.toThrow(
        new BadRequestException('No se adjuntó ningún archivo.'),
      );
    });

    it('Debe rechazar carpetas con caracteres de navegación de directorios (Path Traversal)', async () => {
      // Arrange
      const mockPdfFile: any = {
        filename: 'contrato.pdf',
        mimetype: 'application/pdf',
        file: Readable.from(['pdf']),
      };

      // Act & Assert
      await expect(FileStorageUtil.guardarArchivoMultipart(mockPdfFile, '../etc')).rejects.toThrow(
        new BadRequestException('Carpeta de archivos inválida.'),
      );
    });

    it('Debe rechazar archivos con mimetypes no permitidos (ejemplo: .exe, .png, .jpg)', async () => {
      // Arrange
      const resumeSpy = jest.fn();
      const mockExecutableFile: any = {
        filename: 'script_malicioso.exe',
        mimetype: 'application/x-msdownload',
        file: { resume: resumeSpy },
      };

      // Act & Assert
      await expect(FileStorageUtil.guardarArchivoMultipart(mockExecutableFile, 'contratos')).rejects.toThrow(
        new BadRequestException('Solo se permiten archivos PDF o Word con extensión y MIME compatibles.'),
      );
      expect(resumeSpy).toHaveBeenCalled();
    });
  });

  describe('guardarArchivoMultipart() - Persistencia y Límites de Tamaño', () => {
    it('Debe guardar un archivo PDF válido y retornar la ruta relativa del archivo', async () => {
      // Arrange
      const mockPdfFile: any = {
        filename: 'contrato_firmado.pdf',
        mimetype: 'application/pdf',
        file: Readable.from([Buffer.from('contenido-pdf-stream')]),
      };

      // Act
      const rutaResultado = await FileStorageUtil.guardarArchivoMultipart(mockPdfFile, 'contratos');

      // Assert
      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('contratos'), { recursive: true });
      expect(fs.open).toHaveBeenCalledWith(expect.stringMatching(/\.pdf$/), 'wx');
      expect(rutaResultado).toMatch(/^\/archivos\/contratos\/\d+-[0-9a-f-]+\.pdf$/i);
    });

    it('Debe guardar un archivo DOCX de Word válido y retornar la ruta relativa', async () => {
      // Arrange
      const mockWordFile: any = {
        filename: 'adenda_laboral.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        file: Readable.from([Buffer.from('contenido-word-stream')]),
      };

      // Act
      const rutaResultado = await FileStorageUtil.guardarArchivoMultipart(mockWordFile, 'legajos');

      // Assert
      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('legajos'), { recursive: true });
      expect(rutaResultado).toMatch(/^\/archivos\/legajos\/\d+-[0-9a-f-]+\.docx$/i);
    });

    it('Debe lanzar PayloadTooLargeException y limpiar el archivo si el stream viene truncado', async () => {
      // Arrange
      const streamTruncado: any = Readable.from([Buffer.from('parcial')]);
      streamTruncado.truncated = true;
      const mockFile: any = {
        filename: 'pesado.pdf',
        mimetype: 'application/pdf',
        file: streamTruncado,
      };

      // Act & Assert
      await expect(FileStorageUtil.guardarArchivoMultipart(mockFile, 'contratos')).rejects.toThrow(
        PayloadTooLargeException,
      );
      expect(fs.rm).toHaveBeenCalled();
    });

    it('Debe lanzar PayloadTooLargeException si el contenido supera los 5 MB permitidos', async () => {
      // Arrange
      const chunkGrande = Buffer.alloc(5 * 1024 * 1024 + 1024, 'a');
      const mockFile: any = {
        filename: 'exceso.pdf',
        mimetype: 'application/pdf',
        file: Readable.from([chunkGrande]),
      };

      // Act & Assert
      await expect(FileStorageUtil.guardarArchivoMultipart(mockFile, 'contratos')).rejects.toThrow(
        PayloadTooLargeException,
      );
      expect(fs.rm).toHaveBeenCalled();
    });
  });

  describe('eliminarArchivo() - Eliminación Segura', () => {
    it('Debe eliminar un archivo válido ubicado dentro de /archivos/', async () => {
      // Arrange & Act
      await FileStorageUtil.eliminarArchivo('/archivos/contratos/123-archivo.pdf');

      // Assert
      expect(fs.rm).toHaveBeenCalledWith(expect.stringContaining('123-archivo.pdf'), { force: true });
    });

    it('Debe rechazar rutas fuera del directorio /archivos/ por seguridad', async () => {
      // Arrange & Act & Assert
      await expect(FileStorageUtil.eliminarArchivo('/etc/passwd')).rejects.toThrow(BadRequestException);
      await expect(FileStorageUtil.eliminarArchivo('/archivos/../../secret.txt')).rejects.toThrow(BadRequestException);
    });
  });
});