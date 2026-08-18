//test/common/utils/fileStorage.util.spec.ts
import { BadRequestException } from '@nestjs/common';
import { FileStorageUtil } from '@/common/utils/fileStorage.util';
import * as fs from 'fs';
import { Readable, Writable } from 'stream';

//Mockear el módulo 'fs' para evitar interacciones reales con el sistema de archivos durante las pruebas
jest.mock('fs', () => {
    const actualFs = jest.requireActual('fs');
    return {
        ...actualFs,
        existsSync: jest.fn(),
        mkdirSync: jest.fn(),
        createWriteStream: jest.fn(() => {
            // Mocking Writable stream so pipeline() completes instantly without timing out
            return new Writable({
                write(chunk, encoding, callback) {
                callback();
                }
            });
        }),
    };
});

/**
 * Pruebas unitarias para el utilitario de almacenamiento de archivos.
 * Estas pruebas validan el comportamiento de la función guardarArchivoMultipart en diferentes escenarios,
 * incluyendo la validación de entrada, la persistencia exitosa y el manejo de errores.
 * Se utilizan mocks para simular la interacción con el sistema de archivos y evitar efectos secundarios durante las pruebas.
 */
describe('FileStorageUtil - Pruebas Unitarias de Almacenamiento de Archivos', () => {
    //Limpiar los mocks antes de cada prueba para asegurar un estado limpio
    beforeEach(() => jest.clearAllMocks());

    describe('guardarArchivoMultipart() - Validaciones de Entrada', () => {
        it('Debe lanzar BadRequestException si el objeto de archivo es null o undefined', async () => {
            //Assert
            await expect(FileStorageUtil.guardarArchivoMultipart(null, 'contratos')).rejects.toThrow(new BadRequestException('No se adjuntó ningún archivo.'));
            await expect(FileStorageUtil.guardarArchivoMultipart(undefined, 'contratos')).rejects.toThrow(new BadRequestException('No se adjuntó ningún archivo.'));
        });

        it('Debe rechazar archivos con mimetypes no permitidos (ejemplo: .exe, .png, .jpg)', async () => {
            //Arrange: Simular un archivo con mimetype no permitido
            const mockExecutableFile = {
                filename: 'script_malicioso.exe',
                mimetype: 'application/x-msdownload',
                file: new Readable({ read() {} })
            };

            //Act & Assert: Se espera que la función lance una excepción de tipo BadRequestException
            await expect(FileStorageUtil.guardarArchivoMultipart(mockExecutableFile, 'contratos')).rejects.toThrow(
                new BadRequestException('Tipo de archivo no permitido. Solo se permiten archivos PDF y Word.')
            );
        });
    });

    describe('guardarArchivoMultipart() - Persistencia Exitosa', () => {
        it('Debe guardar un archivo PDF válido y retornar la ruta relativa del archivo', async () => {
            //Arrange: Simular un archivo PDF válido
            const mockPdfFile = {
                filename: 'contrato_firmado.pdf',
                mimetype: 'application/pdf',
                file: Readable.from(['contenido-pdf-stream'])
            };

            //Act: Simular que la carpeta de destino no existe para probar la creación de directorios
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            const rutaResultado = await FileStorageUtil.guardarArchivoMultipart(mockPdfFile, 'contratos');

            //Assert: Verificar que se haya intentado crear la carpeta y que la ruta devuelta sea correcta
            expect(fs.existsSync).toHaveBeenCalled();
            expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('contratos'), { recursive: true });
            expect(rutaResultado).toMatch(/^\/archivos\/contratos\/\d+-[0-9a-f-]+\.pdf$/i);
        });

        it('Debe guardar un archivo DOCX de Word válido y retornar la ruta relativa', async () => {
            //Arrange: Simular un archivo DOCX válido
            const mockWordFile = {
                filename: 'adenda_laboral.docx',
                mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                file: Readable.from(['contenido-word-stream'])
            };

            //Act: Simular que la carpeta de destino ya existe para probar el flujo sin creación de directorios
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            const rutaResultado = await FileStorageUtil.guardarArchivoMultipart(mockWordFile, 'legajos');

            //Assert: Verificar que no se haya intentado crear la carpeta y que la ruta devuelta sea correcta
            expect(fs.mkdirSync).not.toHaveBeenCalled();
            expect(rutaResultado).toMatch(/^\/archivos\/legajos\/\d+-[0-9a-f-]+\.docx$/i);
        });
    });
});