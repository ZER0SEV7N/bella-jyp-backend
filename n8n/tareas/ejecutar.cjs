//n8n/tareas/ejecutar.cjs
require('dotenv').config({ quiet: true });
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve, join } = require('node:path');
const { IdentityGenerator } = require('../../dist/common/utils/uuid.util');
const { llamarApi, filasTrabajo } = require('./cliente-api.cjs');
const { exportar } = require('./exportar.cjs');
const { emitirBoletas, enviarRecuperacion } = require('./boletas.cjs');

/**
 * Tarea que ejecuta un trabajo de integración n8n, generando archivos y correos según el tipo de trabajo.
 * Su utilidad es procesar trabajos de integración n8n, generando archivos y correos electrónicos según el tipo de trabajo especificado.
 * Las funciones son:
 * - ejecutar: Ejecuta un trabajo de integración n8n, generando archivos y correos según el tipo de trabajo.
 */

/**
 * Ejecuta un trabajo de integración n8n, generando archivos y correos según el tipo de trabajo.
 * @param {*} id - El identificador del trabajo a ejecutar.
 * @returns - {Promise<*>} - Un objeto que contiene los resultados de la ejecución del trabajo, incluyendo archivos generados y correos preparados.
 */
async function ejecutar(id) {
    // Validación de la solicitud de recuperación de contraseña
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test( id || ''))
        throw new Error('Identificador de trabajo inválido.');
    
    // Genera un ID de ejecución único para el trabajo y configura la ruta de la API del backend
    const ejecucionId = IdentityGenerator.generateId();
    // Reclamación del trabajo en el backend para obtener los detalles del trabajo y preparar la ejecución
    const prefijo = `/api/v1/integraciones/n8n/trabajos/${id}`;

    // Llama a la API del backend para reclamar el trabajo y obtener los detalles necesarios para la ejecución
    const trabajo = await llamarApi('POST', `${prefijo}/reclamar`, {ejecucion_id: ejecucionId});

    // Configura el directorio donde se guardarán los archivos generados y prepara un objeto para almacenar los resultados de la ejecución
    const directorio = resolve(process.env.ARCHIVOS_INTEGRACION_DIR || '/files', id);

    // Inicializa un objeto para almacenar los resultados de la ejecución, incluyendo archivos generados y correos preparados
    const resultado = { archivos: [], correos: [] };

    // Intenta crear el directorio para los archivos generados y maneja posibles errores durante la ejecución del trabajo
    try {
        // Crea el directorio para los archivos generados con permisos de lectura, escritura y ejecución solo para el propietario
        await mkdir(directorio, { recursive: false, mode: 0o700 });
        // Obtiene un generador de filas de trabajo desde la API del backend para procesar las filas correspondientes al trabajo
        const filas = filasTrabajo(id, ejecucionId);

        // Ejecuta la lógica específica según el tipo de trabajo (RESET_PASSWORD, BOLETAS u otros) y maneja posibles errores durante la ejecución
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
        resultado.error ='No se pudo escribir el manifiesto local. Revise el almacenamiento antes de reintentar.';
    });
    // Envía el resultado de la ejecución del trabajo al backend para registrar los archivos generados y los correos preparados, y maneja posibles errores durante la comunicación con la API del backend
    await llamarApi(
        'POST',
        `${prefijo}/resultado?ejecucion_id=${ejecucionId}`,
        resultado
    );

    // Si el resultado contiene un error, lanza una excepción para indicar que el trabajo finalizó con errores y se debe consultar su estado en el backend
    if (resultado.error)
        throw new Error('El trabajo finalizó con errores; consulte su estado.');
    return resultado;
}

// Si el script se ejecuta directamente desde la línea de comandos, llama a la función ejecutar con el ID del trabajo proporcionado como argumento y maneja posibles errores durante la ejecución del trabajo
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
