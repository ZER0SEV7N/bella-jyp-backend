//src/common/utils/FileStorageUtil.ts
import * as fs from 'fs'; //Sistema de archivos
import * as path from 'path'; //Rutas de archivos
import { BadRequestException } from '@nestjs/common';
import { pipeline } from 'stream/promises'; //Promesas de flujo de datos
import { IdentityGenerator } from './uuid.util';

/**
 * Utilidad para el almacenamiento de archivos.
 * Esta clase proporciona métodos para guardar archivos en el sistema de archivos local.
 * Los archivos se guardan en la carpeta especificada y se les asigna un nombre único basado en un UUID.
 * Unicamente se permiten archivos PDF y Word, y el tamaño máximo permitido es de 5 MB.
 */

export class FileStorageUtil {
    /**
     * Guarda un archivo en el sistema de archivos local.
     * @param data - Objeto Multipart devuelto por Fastify
     * @param subFolder - La carpeta en la que se guardará el archivo.
     * @returns El nombre del archivo guardado.
     */
    static async guardarArchivoMultipart(data: any, subFolder: string): Promise<string> {
        if(!data) throw new BadRequestException('No se adjuntó ningún archivo.');

        //Filtro de mimetypes permitidos
        const tiposPermitidos = [
            'application/pdf', //pdf
            'application/msword', //doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' //docx
        ];

        //Validar el tipo de archivo
        if(!tiposPermitidos.includes(data.mimetype)) throw new BadRequestException('Tipo de archivo no permitido. Solo se permiten archivos PDF y Word.');

        const extension = path.extname(data.filename); 
        const nombreArchivo = `${Date.now()}-${IdentityGenerator.generateId()}${extension}`; //Generar un nombre de archivo único

        //Crear la ruta completa del archivo
        const uploadDir = path.join(process.cwd(), 'archivos', subFolder);
        if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true }); //Crear la carpeta si no existe

        //Guardar el archivo en el sistema de archivos
        const filePath = path.join(uploadDir, nombreArchivo);
        await pipeline(data.file, fs.createWriteStream(filePath)); //Guardar el archivo

        //Retornar la ruta relativa del archivo
        return `/archivos/${subFolder}/${nombreArchivo}`; //Retornar la ruta relativa del archivo
    }
}