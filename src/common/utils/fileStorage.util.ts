//src/common/utils/fileStorage.util.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { MultipartFile } from '@fastify/multipart';
import { BadRequestException, Logger, PayloadTooLargeException } from '@nestjs/common';
import { IdentityGenerator } from './uuid.util';

// Definición de tamaño máximo de archivo permitido (5 MB)
const MAX_ARCHIVO_BYTES = 5 * 1024 * 1024;

// Definición de extensiones permitidas para cada tipo MIME
const EXTENSIONES_PERMITIDAS: Record<string, string[]> = {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'text/csv': ['.csv'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

/**
 * Clase utilitaria para el almacenamiento de archivos en el sistema de archivos del servidor. 
 * Permite guardar archivos subidos mediante multipart/form-data y eliminarlos de manera segura.
 * 
 * Funcionalidades principales:
 * - Guardar archivos subidos mediante multipart/form-data en una carpeta específica del servidor.
 * - Validar el tipo MIME y la extensión del archivo para garantizar que solo se acepten archivos PDF o Word.
 * - Limitar el tamaño máximo de los archivos a 5 MB, lanzando una excepción si se excede este límite.
 * - Eliminar archivos del sistema de archivos de manera segura, asegurando que la ruta proporcionada corresponda a un archivo administrado por el sistema.
 * 
 * Esta clase es esencial para manejar la carga y eliminación de archivos en la aplicación, asegurando que se cumplan las restricciones de seguridad y tamaño.
 */
export class FileStorageUtil {
    private static readonly logger = new Logger(FileStorageUtil.name);

    /**
     * Guarda un archivo subido mediante multipart/form-data en una carpeta específica del servidor.
     * @param data - El archivo subido mediante multipart/form-data, representado como un objeto MultipartFile.
     * @param subFolder - La subcarpeta dentro de la carpeta 'archivos' donde se almacenará el archivo. 
     * Debe ser un nombre válido que cumpla con el patrón /^[a-z0-9_-]+$/i.
     * @returns - Una promesa que resuelve la ruta relativa del archivo guardado en el servidor, comenzando con '/archivos/'.
     * @throws - Lanza una excepción BadRequestException si no se adjunta ningún archivo, 
     * si la subcarpeta es inválida, si el tipo MIME o la extensión del archivo no son permitidos, o si el tamaño del archivo excede los 5 MB.
     */
    static async guardarArchivoMultipart(data: MultipartFile, subFolder: string): Promise<string> {
        // Validación de entrada y restricciones de seguridad
        if (!data) 
            throw new BadRequestException('No se adjuntó ningún archivo.');
        
        // Validación de la subcarpeta para evitar rutas no válidas o ataques de path traversal
        if (!/^[a-z0-9_-]+$/i.test(subFolder))
            throw new BadRequestException('Carpeta de archivos inválida.');

        // Validación del tipo MIME y la extensión del archivo para garantizar que solo se acepten archivos PDF o Word
        const extension = path.extname(data.filename).toLowerCase();

        // Verificación de que el tipo MIME y la extensión del archivo sean compatibles con las extensiones permitidas
        if (!EXTENSIONES_PERMITIDAS[data.mimetype]?.includes(extension)) {
            data.file.resume();
            throw new BadRequestException('Solo se permiten archivos PDF o Word con extensión y MIME compatibles.');
        }

        // Generación de un nombre de archivo único utilizando la fecha actual y un identificador generado
        const nombreArchivo = `${Date.now()}-${IdentityGenerator.generateId()}${extension}`;
        const uploadDir = path.join(process.cwd(), 'archivos', subFolder);
        const filePath = path.join(uploadDir, nombreArchivo);
        await fs.mkdir(uploadDir, { recursive: true });

        // Transform stream para limitar el tamaño del archivo a 5 MB y lanzar una excepción si se excede este límite
        let bytes = 0;
        const limite = new Transform({
            transform(chunk, encoding, callback) {
                bytes += chunk.length;
                callback(bytes > MAX_ARCHIVO_BYTES ? new PayloadTooLargeException('El archivo no puede superar los 5 MB.') : null, chunk);
            },
        });

        // Apertura del archivo de destino en modo 'wx' para evitar sobrescribir archivos existentes
        const salida = await fs.open(filePath, 'wx');

        // Uso de pipeline para manejar la transmisión de datos del archivo subido al archivo de destino, con manejo de errores y limpieza en caso de fallo
        try {
            await pipeline(data.file, limite, salida.createWriteStream());

            if (data.file.truncated) throw new PayloadTooLargeException('El archivo no puede superar los 5 MB.');

            // Retorna la ruta relativa del archivo guardado en el servidor, comenzando con '/archivos/'
            return `/archivos/${subFolder}/${nombreArchivo}`;
        } catch (error) {

            // En caso de error, se intenta eliminar el archivo incompleto y se lanza la excepción correspondiente
            await fs.rm(filePath, { force: true }).catch((cleanupError: unknown) =>
                this.logger.warn('No se pudo eliminar un archivo incompleto.', cleanupError));
            throw error;
        } finally {
            await salida.close();
        }
    }

    /**
     * Elimina un archivo del sistema de archivos del servidor de manera segura.
     * @param url - La ruta relativa del archivo a eliminar, comenzando con '/archivos/'.
     * @returns - Una promesa que se resuelve cuando el archivo ha sido eliminado correctamente.
     * @throws - Lanza una excepción BadRequestException si la ruta proporcionada no corresponde a un archivo administrado por el sistema.
     */
    static async eliminarArchivo(url: string): Promise<void> {
        // Validación de la ruta del archivo para asegurar que corresponda a un archivo administrado por el sistema y evitar ataques de path traversal
        const raiz = path.resolve(process.cwd(), 'archivos');
        const destino = path.resolve(process.cwd(), `.${url}`);
        const relativa = path.relative(raiz, destino);

        // Validación de la ruta del archivo para asegurar que corresponda a un archivo administrado por el sistema y evitar ataques de path traversal
        if (!url.startsWith('/archivos/') || !relativa || relativa.startsWith('..') || path.isAbsolute(relativa))
            throw new BadRequestException('La ruta no corresponde a un archivo administrado por el sistema.');

        // Eliminación del archivo de manera segura, utilizando la opción 'force' para evitar errores si el archivo no existe
        await fs.rm(destino, { force: true });
    }
}
