require('dotenv').config({ quiet: true });
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve, join } = require('node:path');
const { IdentityGenerator } = require('../../dist/common/utils/uuid.util');
const { llamarApi, filasTrabajo } = require('./cliente-api.cjs');
const { exportar } = require('./exportar.cjs');
const { emitirBoletas, enviarRecuperacion } = require('./boletas.cjs');

/** Punto de entrada del comando ejecutado dentro del contenedor n8n; solo recibe un UUID validado. */
async function ejecutar(id) {
    if (
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
            id || ''
        )
    )
        throw new Error('Identificador de trabajo inválido.');
    const ejecucionId = IdentityGenerator.generateId();
    const prefijo = `/api/v1/integraciones/n8n/trabajos/${id}`;
    const trabajo = await llamarApi('POST', `${prefijo}/reclamar`, {
        ejecucion_id: ejecucionId,
    });
    const directorio = resolve(
        process.env.ARCHIVOS_INTEGRACION_DIR || '/files',
        id
    );
    const resultado = { archivos: [], correos: [] };
    try {
        await mkdir(directorio, { recursive: false, mode: 0o700 });
        const filas = filasTrabajo(id, ejecucionId);
        if (trabajo.tipo === 'RESET_PASSWORD')
            await enviarRecuperacion(trabajo, directorio, resultado);
        else if (trabajo.tipo === 'BOLETAS')
            await emitirBoletas(trabajo, filas, directorio, resultado);
        else resultado.archivos = await exportar(trabajo, filas, directorio);
    } catch (error) {
        // El error describe el dato faltante o la fase; nunca se persiste la solicitud ni el token.
        resultado.error = String(
            error.message || 'No se pudo generar el archivo.'
        ).slice(0, 2000);
    }
    // El manifiesto no contiene contraseñas de PDF, cuentas ni enlaces de recuperación.
    await writeFile(
        join(directorio, 'manifest.json'),
        JSON.stringify(resultado, null, 2),
        { mode: 0o600 }
    ).catch(() => {
        resultado.error =
            'No se pudo escribir el manifiesto local. Revise el almacenamiento antes de reintentar.';
    });
    await llamarApi(
        'POST',
        `${prefijo}/resultado?ejecucion_id=${ejecucionId}`,
        resultado
    );
    if (resultado.error)
        throw new Error('El trabajo finalizó con errores; consulte su estado.');
    return resultado;
}

if (require.main === module)
    ejecutar(process.argv[2])
        .then(() => console.log('Trabajo procesado.'))
        .catch(() => {
            console.error(
                'No se completó el trabajo. Consulte su registro de integración.'
            );
            process.exitCode = 1;
        });
module.exports = { ejecutar };
