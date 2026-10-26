//src/modules/asistencia/helpers/archivo-biometrico.helper.ts
import type { MultipartFile } from '@fastify/multipart';
import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as unzipper from 'unzipper';

/**
 * Helper encargado de manejar archivos Excel de marcaciones de asistencia, asegurando su validez y proporcionando un mecanismo para leer su contenido.
 * Este helper crea un directorio temporal, guarda el archivo Excel en él, valida su contenido y luego ejecuta una función de lectura proporcionada por el usuario.
 */

/**
 * Función asíncrona que guarda un archivo Excel de marcaciones de asistencia en una ruta específica, asegurando que no supere los límites de tamaño y calculando su hash SHA-256.
 * @param archivo - El archivo Excel de marcaciones de asistencia a guardar.
 * @param ruta - La ruta donde se guardará el archivo Excel.
 * @returns - Una promesa que se resuelve con el hash SHA-256 del archivo guardado.
 * @throws BadRequestException si el archivo supera los límites de tamaño permitidos o si ocurre algún error durante la escritura del archivo.
 */
async function guardarArchivoAcotado(archivo: MultipartFile, ruta: string): Promise<string> {
    let bytes = 0; //Contador de bytes leídos del archivo para asegurar que no supere los límites de tamaño permitidos.
    const hash = createHash('sha256'); //Se crea un objeto hash para calcular el hash SHA-256 del archivo mientras se lee y se guarda en la ruta especificada.
    
    //Se utiliza un Transform stream para leer el archivo en chunks, actualizar el contador de bytes y calcular el hash mientras se escribe en la ruta especificada.
    const limite = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            bytes += chunk.length;

            //Si el tamaño del archivo supera los 2 MB, se lanza una excepción de tipo BadRequestException indicando que el archivo es demasiado grande.
            if (bytes > 2 * 1024 * 1024) 
                return callback(new BadRequestException('El Excel no puede superar 2 MB.'));
            hash.update(chunk);
            callback(null, chunk);
        }
    });

    //Se utiliza pipeline para leer el archivo, pasar por el Transform stream que valida el tamaño y calcula el hash, y finalmente escribir en la ruta especificada.
    await pipeline(archivo.file, limite, createWriteStream(ruta));

    //Si el archivo fue truncado durante la lectura (lo que indica que superó los límites de tamaño permitidos), se lanza una excepción de tipo BadRequestException.
    if (archivo.file.truncated) 
        throw new BadRequestException('El archivo supera el tamaño permitido.');
    
    //Se devuelve el hash SHA-256 del archivo guardado en formato hexadecimal.
    return hash.digest('hex');
}

/**
 * Función asíncrona que valida el contenido de un archivo Excel de marcaciones de asistencia, asegurando que cumpla con los requisitos de formato y tamaño.
 * @param ruta - La ruta del archivo Excel a validar.
 * @returns - Una promesa que se resuelve con un booleano indicando si el archivo utiliza el sistema de fechas 1904.
 * @throws BadRequestException si el contenido del archivo no cumple con los requisitos de formato o tamaño.
 */
async function validarContenidoExcel(ruta: string): Promise<boolean> {
    //Se abre el archivo Excel como un archivo ZIP utilizando la librería unzipper.
    const zip = await unzipper.Open.file(ruta);
    //Se calcula el tamaño total descomprimido del contenido del archivo ZIP y se verifica que no supere los límites de tamaño permitidos (20 MB).
    const descomprimido = zip.files.reduce((total, entrada) => total + entrada.uncompressedSize, 0);
    //Si el número de archivos dentro del ZIP supera los 128 o el tamaño descomprimido supera los 20 MB, 
    //se lanza una excepción de tipo BadRequestException indicando que el contenido del archivo excede los límites permitidos.
    if (zip.files.length > 128 || descomprimido > 20 * 1024 * 1024)
        throw new BadRequestException('El contenido descomprimido excede los límites del importador.');
    
    //Se busca el archivo de propiedades del libro Excel.
    const propiedades = zip.files.find((e) => e.path === 'xl/workbook.xml');
    //Si no se encuentra el archivo de propiedades o si su tamaño descomprimido supera los 64 KB, 
    //se lanza una excepción de tipo BadRequestException indicando que el libro Excel no es válido.
    if (!propiedades || propiedades.uncompressedSize > 65536) 
        throw new BadRequestException('El libro Excel no es válido.');

    //Se lee el contenido del archivo de propiedades y se verifica si utiliza el sistema de fechas 1904, devolviendo un booleano que indica el resultado.
    return /date1904="(?:1|true)"/.test((await propiedades.buffer()).toString());
}

/**
 * Función asíncrona que maneja un archivo Excel de marcaciones de asistencia, asegurando su validez y proporcionando un mecanismo para leer su contenido.
 * Esta función crea un directorio temporal, guarda el archivo Excel en él, valida su contenido y luego ejecuta una función de lectura proporcionada por el usuario.
 * @param archivo - El archivo Excel de marcaciones de asistencia a procesar.
 * @param leer - Una función asíncrona que se ejecutará con la ruta del archivo, un indicador de si se utiliza el sistema de fechas 1904 y el hash del archivo.
 * @returns - Una promesa que se resuelve con el resultado de la función `leer`, o lanza una excepción si ocurre algún error durante el procesamiento del archivo.
 * @throws - Error de tipo BadRequestException si el archivo no es un Excel válido, excede los límites de tamaño o contiene errores en su contenido.
 */
export async function conArchivoBiometrico<T>(archivo: MultipartFile, leer: (ruta: string, usa1904: boolean, archivoHash: string) => Promise<T>): Promise<T> {
    //Se crea un directorio temporal para almacenar el archivo Excel de marcaciones de asistencia.
    const directorio = await mkdtemp(join(tmpdir(), 'jyp-asistencia-'));
    const ruta = join(directorio, 'marcaciones.xlsx');

    //Se intenta guardar el archivo Excel en el directorio temporal, 
    //validar su contenido y luego ejecutar la función de lectura proporcionada por el usuario.
    try {
        const archivoHash = await guardarArchivoAcotado(archivo, ruta);
        const usa1904 = await validarContenidoExcel(ruta);
        return await leer(ruta, usa1904, archivoHash);
    } catch (error) {
        //Se manejan errores específicos relacionados con la validez del archivo Excel 
        //y se lanzan excepciones de tipo BadRequestException con mensajes adecuados.
        if (error instanceof BadRequestException) 
            throw error;
        
        if (error instanceof Error && /zip|central directory|end of|xlsx|invalid signature/i.test(error.message))
            throw new BadRequestException('El archivo no es un Excel XLSX válido.');
        
        throw error;
    } finally {
        await rm(directorio, { recursive: true, force: true });
    }
}
