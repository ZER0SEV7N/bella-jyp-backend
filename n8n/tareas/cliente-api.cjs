const { firmarM2m } = require('../../dist/common/utils/firma-m2m.util');
const { IdentityGenerator } = require('../../dist/common/utils/uuid.util');

/** Cliente M2M del ejecutor. Cada llamada tiene una firma y un nonce nuevos. */
async function llamarApi(metodo, ruta, cuerpo = null) {
    const secreto = process.env.N8N_WEBHOOK_SECRET || '';
    const instante = String(Math.floor(Date.now() / 1000));
    const nonce = IdentityGenerator.generateId();
    const respuesta = await fetch(
        new URL(ruta, process.env.JYP_BACKEND_URL || 'http://backend:3000'),
        {
            method: metodo,
            headers: {
                'Content-Type': 'application/json',
                'X-Jyp-Timestamp': instante,
                'X-Jyp-Nonce': nonce,
                'X-Jyp-Signature': firmarM2m(
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
    const datos = await respuesta.json();
    if (!respuesta.ok)
        throw new Error(
            `Backend ${respuesta.status}: ${datos.detail || datos.message || 'No se pudo completar la operación.'}`
        );
    return datos.data === undefined ? datos : datos.data;
}

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
