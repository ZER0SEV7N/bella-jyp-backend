//n8n/tareas/cliente-api.cjs
const { firmarM2M } = require('../../dist/common/utils/firma-m2m.util');
const { IdentityGenerator } = require('../../dist/common/utils/uuid.util');
const firmar = firmarM2M || firmarM2m;

/**
 * Tarea que proporciona funciones para interactuar con la API del backend de manera segura mediante autenticación M2M.
 * Sus principales funciones son:
 * - llamarApi: Llama a la API del backend con autenticación M2M, enviando solicitudes HTTP y manejando la respuesta.
 * - filasTrabajo: Genera un iterador asíncrono que devuelve filas de trabajo desde la API del backend.
 * Estas funciones permiten a los trabajadores de n8n interactuar con la API del backend para obtener datos de trabajo y enviar resultados de manera segura.
 */

/**
 * Llama a la API del backend con autenticación M2M.
 * @param {string} metodo - El método HTTP a utilizar (GET, POST, etc.).
 * @param {string} ruta - La ruta de la API a la que se desea llamar.
 * @param {*} cuerpo - El cuerpo de la solicitud (opcional).
 * @returns {Promise<*>} - Los datos devueltos por la API.
 * @throws {Error} - Si la respuesta de la API no es exitosa.
 */
async function llamarApi(metodo, ruta, cuerpo = null) {
    // Configura los parámetros de autenticación M2M
    const secreto = process.env.N8N_WEBHOOK_SECRET || '';
    // Configura el instante y el nonce para la firma
    const instante = String(Math.floor(Date.now() / 1000));
    // Genera un nonce único para la solicitud
    const nonce = IdentityGenerator.generateId();
    
    // Realiza la llamada a la API del backend con los encabezados de autenticación M2M
    const respuesta = await fetch( new URL(ruta, process.env.JYP_BACKEND_URL || 'http://backend:3000'),
        {
            method: metodo,
            headers: {
                'Content-Type': 'application/json',
                'X-Jyp-Timestamp': instante,
                'X-Jyp-Nonce': nonce,
                'X-Jyp-Signature': firmar(
                    secreto,
                    metodo,
                    ruta,
                    instante,
                    nonce,
                    cuerpo
                ),
            },
            ...(metodo === 'GET' ? {} : { body: JSON.stringify(cuerpo) }),
            signal: AbortSignal.timeout(30000),
        }
    );

    // Procesa la respuesta de la API y maneja errores si la respuesta no es exitosa
    const datos = await respuesta.json();

    // Lanza un error si la respuesta de la API no es exitosa
    if (!respuesta.ok)
        throw new Error(`Backend ${respuesta.status}: ${datos.detail || datos.message || 'No se pudo completar la operación.'}`);
    return datos.data === undefined ? datos : datos.data;
}

/**
 * Genera un iterador asíncrono que devuelve filas de trabajo desde la API del backend.
 * @param {string} id - El ID del trabajo para el cual se desean obtener las filas.
 * @param {string} ejecucionId - El ID de la ejecución del trabajo.
 * @returns {AsyncGenerator<*>} - Un generador asíncrono que devuelve filas de trabajo.
 * @throws {Error} - Si ocurre un error al llamar a la API.
 */
async function* filasTrabajo(id, ejecucionId) {
    let pagina = 0;
    while (pagina !== null) {
        const datos = await llamarApi(
            'GET',
            `/api/v1/integraciones/n8n/trabajos/${id}/datos?pagina=${pagina}&ejecucion_id=${ejecucionId}`
        );
        for (const fila of datos.filas) yield fila;
        pagina = datos.siguiente;
    }
}

module.exports = { llamarApi, filasTrabajo };
