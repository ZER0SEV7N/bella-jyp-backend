//src/modules/RRHH/solicitudes/helpers/multipartSolicitud.helper.ts
import { BadRequestException, Logger, PayloadTooLargeException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { FileStorageUtil } from '@/common/utils/fileStorage.util';

//Configuración del logger para el módulo de multipart de solicitudes.
const logger = new Logger('MultipartSolicitud');
const CAMPOS_NUMERICOS = new Set(['monto', 'dias_solicitados']);
const CAMPOS_OPCIONALES = new Set(['empleado_id', 'monto', 'fecha_inicio', 'fecha_fin', 'dias_solicitados', 'observacion', 'origen']);

/**
 * Funcion que elimina un archivo de sustento de una solicitud, dado su URL.
 * @param url - La URL del archivo de sustento a eliminar.
 * @returns - Una promesa que se resuelve cuando el archivo ha sido eliminado o si no se proporcionó una URL.
 * @throws - No lanza excepciones si ocurre un error al eliminar el archivo, solo registra una advertencia en el logger.
 */
export async function limpiarSustentoSolicitud(url?: string): Promise<void> {
    if (!url) return;
    await FileStorageUtil.eliminarArchivo(url).catch((error: unknown) => logger.warn('No se pudo eliminar un sustento de una solicitud fallida.', error));
}

/**
 * Funcion que lee y procesa un formulario multipart de solicitud, extrayendo los campos y el archivo adjunto.
 * @param req - La solicitud Fastify que contiene el formulario multipart.
 * @returns - Un objeto que contiene los campos del formulario y el archivo adjunto (si existe).
 * @throws - Lanza excepciones de BadRequestException o PayloadTooLargeException si hay errores en el procesamiento del formulario.
 */
export async function leerMultipartSolicitud(req: FastifyRequest) {
    const campos: Record<string, unknown> = Object.create(null); //Objeto para almacenar los campos del formulario.
    const recibidos = new Set<string>(); //Conjunto para rastrear los nombres de los campos recibidos y evitar duplicados.
    let archivo: { url: string; nombreOriginal: string } | undefined; //Variable para almacenar la información del archivo adjunto (si existe).

    try {
        //Lee las partes del formulario multipart con límites de tamaño y cantidad de archivos y campos.
        const partes = req.parts({ limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 15, parts: 16, fieldSize: 8192, fieldNameSize: 100 } });

        for await (const parte of partes) {

            //Si la parte es un archivo, verifica que sea el único archivo adjunto y que cumpla con las restricciones de nombre y tamaño.
            if (parte.type === 'file') {

                //Si el campo no es 'archivo', ya se recibió un archivo o el nombre del archivo es inválido, descarta la parte y lanza una excepción.
                if (parte.fieldname !== 'archivo' || archivo || !parte.filename || parte.filename.length > 150) {
                    parte.file.resume();
                    throw new BadRequestException('Debe adjuntar un único archivo en el campo archivo, con nombre de hasta 150 caracteres.');
                }

                //Guarda el archivo en el almacenamiento y almacena la URL y el nombre original del archivo.
                const url = await FileStorageUtil.guardarArchivoMultipart(parte, 'sustentos');
                archivo = { url, nombreOriginal: parte.filename };
                continue;
            }

            //Si la parte es un campo de formulario, verifica que no exceda los límites de longitud y que no esté duplicado.
            if (parte.valueTruncated || parte.fieldnameTruncated)
                throw new BadRequestException('Un campo del formulario excede la longitud permitida.');


            //Si el campo ya fue recibido, lanza una excepción indicando que está duplicado.
            if (recibidos.has(parte.fieldname)) throw new BadRequestException(`El campo '${parte.fieldname}' está duplicado.`);
            
            //Agrega el nombre del campo al conjunto de campos recibidos y almacena su valor en el objeto de campos, convirtiendo a número si corresponde.
            recibidos.add(parte.fieldname);

            //Si el campo es opcional y su valor es una cadena vacía, lo omite.
            if (parte.value === '' && CAMPOS_OPCIONALES.has(parte.fieldname)) continue;

            //Si el campo es obligatorio y su valor es una cadena vacía, lanza una excepción indicando que es obligatorio.
            const valor = parte.value;
            campos[parte.fieldname] = CAMPOS_NUMERICOS.has(parte.fieldname) && typeof valor === 'string' && /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(valor.trim()) ? Number(valor) : valor;
        }

        return { campos, archivo };
    } catch (error) {
        await limpiarSustentoSolicitud(archivo?.url);

        //Manejo de errores específicos relacionados con el tamaño del archivo y los límites del formulario, lanzando excepciones adecuadas.
        if (error && typeof error === 'object' && 'code' in error) {
            //Si el error es debido a que el archivo es demasiado grande, lanza una excepción PayloadTooLargeException.
            if (error.code === 'FST_REQ_FILE_TOO_LARGE') 
                throw new PayloadTooLargeException('El archivo no puede superar los 5 MB.');

            //Si el error es debido a que se exceden los límites de archivos o campos, lanza una excepción BadRequestException.
            if (['FST_FILES_LIMIT', 'FST_FIELDS_LIMIT', 'FST_PARTS_LIMIT'].includes(String(error.code)))
                throw new BadRequestException('El formulario excede los límites permitidos de archivos o campos.');
        }

        throw error;
    }
}
