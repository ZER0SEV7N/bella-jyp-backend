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

async function guardarArchivoAcotado(archivo: MultipartFile, ruta: string): Promise<string> {
    let bytes = 0;
    const hash = createHash('sha256');
    const limite = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            bytes += chunk.length;
            if (bytes > 2 * 1024 * 1024) return callback(new BadRequestException('El Excel no puede superar 2 MB.'));
            hash.update(chunk);
            callback(null, chunk);
        }
    });
    await pipeline(archivo.file, limite, createWriteStream(ruta));
    if (archivo.file.truncated) throw new BadRequestException('El archivo supera el tamaño permitido.');
    return hash.digest('hex');
}

async function validarContenidoExcel(ruta: string): Promise<boolean> {
    const zip = await unzipper.Open.file(ruta);
    const descomprimido = zip.files.reduce((total, entrada) => total + entrada.uncompressedSize, 0);
    if (zip.files.length > 128 || descomprimido > 20 * 1024 * 1024)
        throw new BadRequestException('El contenido descomprimido excede los límites del importador.');
    const propiedades = zip.files.find((e) => e.path === 'xl/workbook.xml');
    if (!propiedades || propiedades.uncompressedSize > 65536) throw new BadRequestException('El libro Excel no es válido.');
    return /date1904="(?:1|true)"/.test((await propiedades.buffer()).toString());
}

/** El archivo está acotado antes de descomprimir; toda salida temporal se elimina al terminar. */
export async function conArchivoBiometrico<T>(archivo: MultipartFile, leer: (ruta: string, usa1904: boolean, archivoHash: string) => Promise<T>): Promise<T> {
    const directorio = await mkdtemp(join(tmpdir(), 'jyp-asistencia-'));
    const ruta = join(directorio, 'marcaciones.xlsx');
    try {
        const archivoHash = await guardarArchivoAcotado(archivo, ruta);
        const usa1904 = await validarContenidoExcel(ruta);
        return await leer(ruta, usa1904, archivoHash);
    } catch (error) {
        if (error instanceof BadRequestException) throw error;
        if (error instanceof Error && /zip|central directory|end of|xlsx|invalid signature/i.test(error.message))
            throw new BadRequestException('El archivo no es un Excel XLSX válido.');
        throw error;
    } finally {
        await rm(directorio, { recursive: true, force: true });
    }
}
