//src/common/utils/FileStorageUtil.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { MultipartFile } from '@fastify/multipart';
import { BadRequestException, Logger, PayloadTooLargeException } from '@nestjs/common';
import { IdentityGenerator } from './uuid.util';

//Constantes para la validación de archivos
const MAX_ARCHIVO_BYTES = 5 * 1024 * 1024;

//Definición de tipos MIME permitidos y sus extensiones correspondientes
//Extensiones permitidas: PDF y Word (doc, docx) y excel (xls, xlsx, csv)
const EXTENSIONES_PERMITIDAS: Record<string, string[]> = {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'text/csv': ['.csv'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
};

/**
 * Clase utilitaria para el manejo de almacenamiento de archivos en el servidor.
 * Proporciona métodos para guardar y eliminar archivos, asegurando que cumplan con las restricciones de tamaño y tipo.
 * Los archivos se almacenan en la carpeta 'archivos' dentro del directorio de trabajo actual.
 */
export class FileStorageUtil {
    private static readonly logger = new Logger(FileStorageUtil.name);

    /**
     * Clase estática para manejar el almacenamiento de archivos en el servidor.
     * Proporciona métodos para guardar y eliminar archivos, asegurando que cumplan con las restricciones de tamaño y tipo.
     * Los archivos se almacenan en la carpeta 'archivos' dentro del directorio de trabajo actual.
     * @param data - Archivo multipart recibido desde la solicitud HTTP.
     * @param subFolder - Carpeta dentro de 'archivos' donde se guardará el archivo.
     * @returns - Ruta relativa del archivo guardado en el servidor.
     * @throws BadRequestException si no se adjunta un archivo, si la carpeta es inválida o si el tipo de archivo no es permitido.
     * @throws PayloadTooLargeException si el archivo supera el tamaño máximo permitido (5 MB).
     */
    static async guardarArchivoMultipart(data: MultipartFile, subFolder: string): Promise<string> {
        if (!data) throw new BadRequestException('No se adjuntó ningún archivo.');

        //Verificar que el tipo de archivo y la extensión sean válidos
        const extension = path.extname(data.filename).toLowerCase();

        if (!EXTENSIONES_PERMITIDAS[data.mimetype]?.includes(extension)) {
            data.file.resume();
            throw new BadRequestException('Solo se permiten archivos PDF o Word con extensión y MIME compatibles.');
        }

        //Verificar que la carpeta de destino sea válida y no contenga rutas relativas peligrosas
        if (!/^[a-z0-9_-]+$/i.test(subFolder)) throw new BadRequestException('Carpeta de archivos inválida.');

        //Generar un nombre de archivo único para evitar colisiones y mantener la integridad de los archivos
        const nombreArchivo = `${Date.now()}-${IdentityGenerator.generateId()}${extension}`;
        const uploadDir = path.join(process.cwd(), 'archivos', subFolder);
        const filePath = path.join(uploadDir, nombreArchivo);
        await fs.mkdir(uploadDir, { recursive: true });

        //Crear un flujo de transformación para limitar el tamaño del archivo y manejar la escritura en disco
        let bytes = 0;
        const limite = new Transform({
            transform(chunk, encoding, callback) {
                bytes += chunk.length;
                callback(bytes > MAX_ARCHIVO_BYTES ? new PayloadTooLargeException('El archivo no puede superar los 5 MB.') : null, chunk);
            }
        });

        //Si el nombre ya existe, no se borra un archivo ajeno durante la limpieza.
        const salida = await fs.open(filePath, 'wx');

        try {
            //Usar pipeline para manejar el flujo de datos del archivo, 
            //aplicando la transformación de límite de tamaño y escribiendo en el archivo de destino
            await pipeline(data.file, limite, salida.createWriteStream());

            //Verificar si el archivo fue truncado debido a que excedió el tamaño máximo permitido
            if (data.file.truncated) throw new PayloadTooLargeException('El archivo no puede superar los 5 MB.');

            //Retornar la ruta relativa del archivo guardado para su posterior uso o referencia
            return `/archivos/${subFolder}/${nombreArchivo}`;
        } catch (error) {
            //Si ocurre un error durante la escritura, se intenta eliminar el archivo incompleto y se registra una advertencia
            await fs.rm(filePath, { force: true }).catch((cleanupError: unknown) => this.logger.warn('No se pudo eliminar un archivo incompleto.', cleanupError));
            throw error;
        } finally {
            //Cerrar el descriptor de archivo para liberar recursos del sistema
            await salida.close();
        }
    }

    /**
     * Elimina un archivo del servidor dado su URL relativa.
     * @param url - URL relativa del archivo a eliminar (debe comenzar con '/archivos/').
     * @throws BadRequestException si la ruta no corresponde a un archivo administrado por el sistema.
     */
    static async eliminarArchivo(url: string): Promise<void> {
        //Verificar que la ruta del archivo sea válida y esté dentro de la carpeta 'archivos'
        const raiz = path.resolve(process.cwd(), 'archivos');
        const destino = path.resolve(process.cwd(), `.${url}`);
        const relativa = path.relative(raiz, destino);

        //Verificar que la ruta del archivo sea válida y esté dentro de la carpeta 'archivos'
        if (!url.startsWith('/archivos/') || !relativa || relativa.startsWith('..') || path.isAbsolute(relativa))
            throw new BadRequestException('La ruta no corresponde a un archivo administrado por el sistema.');

        await fs.rm(destino, { force: true });
    }
}
