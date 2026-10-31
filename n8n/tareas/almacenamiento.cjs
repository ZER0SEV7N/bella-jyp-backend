const { createReadStream, createWriteStream } = require('node:fs');
const { rename, stat } = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { once } = require('node:events');
const { finished } = require('node:stream/promises');
const { join } = require('node:path');

/** Escritura con backpressure: no acumula el archivo completo en memoria. */
function escritor(directorio, nombre, encoding = 'latin1') {
    const temporal = join(directorio, `${nombre}.pendiente`);
    const stream = createWriteStream(temporal, {
        flags: 'wx',
        mode: 0o600,
        encoding,
    });
    // Registrar el rechazo desde el inicio evita errores de disco no observados durante la paginación.
    const terminado = finished(stream);
    terminado.catch(() => {});
    return {
        stream,
        async linea(texto) {
            if (!stream.write(texto + '\r\n', encoding))
                await once(stream, 'drain');
        },
        async cerrar() {
            stream.end();
            await terminado;
            await rename(temporal, join(directorio, nombre));
        },
        cancelar() {
            stream.destroy();
        },
    };
}

async function metadatos(directorio, nombre, tipo, planillaId) {
    const ruta = join(directorio, nombre);
    const hash = createHash('sha256');
    for await (const fragmento of createReadStream(ruta))
        hash.update(fragmento);
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
