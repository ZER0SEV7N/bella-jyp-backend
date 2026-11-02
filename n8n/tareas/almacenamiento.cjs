//n8n/tareas/almacenamiento.cjs
const { createReadStream, createWriteStream } = require('node:fs');
const { rename, stat } = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { once } = require('node:events');
const { finished } = require('node:stream/promises');
const { join } = require('node:path');

/**
 * Tarea que almacena un archivo en el directorio indicado, 
 * con el nombre indicado, y devuelve un objeto con métodos para escribir líneas, cerrar el archivo y cancelar la operación.
 * sus principales funciones son:
 * - escritor: Crea un escritor de archivos que permite escribir líneas en un archivo temporal y luego renombrarlo al nombre final.
 * - metadatos: Crea un objeto con metadatos del archivo, incluyendo nombre, tipo, tamaño en bytes, hash SHA-256 y opcionalmente el ID de la planilla.
 */

/**
 * Crea un escritor de archivos.
 * @param {*} directorio - El directorio donde se almacenará el archivo.
 * @param {*} nombre - El nombre del archivo a almacenar.
 * @param {*} encoding - La codificación de caracteres para la escritura del archivo.
 * @returns - Un objeto con métodos para escribir líneas, cerrar el archivo y cancelar la operación.
 */
function escritor(directorio, nombre, encoding = 'latin1') {
    // Se crea un archivo temporal con la extensión .pendiente para evitar conflictos de nombres.
    const temporal = join(directorio, `${nombre}.pendiente`);

    // Se crea un flujo de escritura para el archivo temporal con las opciones especificadas.
    const stream = createWriteStream(temporal, {
        flags: 'w',
        mode: 0o600,
        encoding,
    });

    // Registrar el rechazo desde el inicio evita errores de disco no observados durante la paginación.
    const terminado = finished(stream);
    
    // Se ignoran los errores de finalización para evitar que se propaguen.
    terminado.catch(() => {});
    
    // Se devuelve un objeto con métodos para escribir líneas, cerrar el archivo y cancelar la operación.
    return {
        stream,

        // Método para escribir una línea en el archivo.
        async linea(texto) {
            if (!stream.write(texto + '\r\n', encoding))
                await once(stream, 'drain');
        },

        // Método para cerrar el archivo, renombrarlo y esperar a que se complete la operación.
        async cerrar() {
            stream.end();
            await terminado;
            await rename(temporal, join(directorio, nombre));
        },

        // Método para cancelar la operación y destruir el flujo de escritura.
        cancelar() {
            stream.destroy();
        },
    };
}

/**
 * Crea un objeto con metadatos del archivo.
 * el objeto contiene el nombre, tipo, tamaño en bytes, hash SHA-256 y opcionalmente el ID de la planilla.
 * @param {*} directorio - El directorio donde se encuentra el archivo.
 * @param {*} nombre - El nombre del archivo.
 * @param {*} tipo - El tipo de archivo (por ejemplo, 'csv', 'txt').
 * @param {*} planillaId - (Opcional) El ID de la planilla asociada al archivo.
 * @returns - Un objeto con los metadatos del archivo.
 */
async function metadatos(directorio, nombre, tipo, planillaId) {
    // Se obtiene la ruta completa del archivo.
    const ruta = join(directorio, nombre);

    // Se crea un hash SHA-256 del contenido del archivo.
    const hash = createHash('sha256');

    // Se lee el archivo en fragmentos y se actualiza el hash con cada fragmento.
    for await (const fragmento of createReadStream(ruta))
        hash.update(fragmento);

    // Se obtienen los datos del archivo, incluyendo el tamaño en bytes.
    const datos = await stat(ruta);
    return {
        nombre,
        tipo,
        bytes: datos.size,
        sha256: hash.digest('hex'),
        ...(planillaId ? { planilla_id: planillaId } : {}),
    };
}

module.exports = { escritor, metadatos };
