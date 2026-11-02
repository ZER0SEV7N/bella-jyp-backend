//n8n/tareas/boletas.cjs
const { join } = require('node:path');
const { createHmac } = require('node:crypto');
const { generateBoletaPdf } = require('../../dist/modules/payroll/planillas/helpers/generarBoleta.helper');
const { metadatos } = require('./almacenamiento.cjs');
const { prepararCorreo } = require('./correos.cjs');

/**
 * Tarea que emite boletas de pago y envía correos de recuperación de contraseña.
 * Su utilidad es generar archivos PDF de boletas y correos electrónicos de recuperación de contraseña para los empleados.
 * Las boletas se generan en formato PDF con contraseña de apertura basada en el número de documento del empleado.
 * Los correos de recuperación de contraseña se preparan con un enlace seguro que contiene un token de recuperación.
 * Las funciones son: 
 * - emitirBoletas: Genera boletas de pago en formato PDF y prepara correos electrónicos con las boletas adjuntas.
 * - enviarRecuperacion: Prepara correos electrónicos de recuperación de contraseña con un enlace seguro.
 */

/**
 * Emite boletas de pago para una lista de filas.
 * @param {*} trabajo - El objeto de trabajo que contiene la información de la tarea.
 * @param {*} filas - Una lista de filas que contienen los datos necesarios para generar las boletas.
 * @param {*} directorio - El directorio donde se guardarán los archivos generados.
 * @param {*} resultado - Un objeto donde se almacenarán los resultados de la tarea, incluyendo los archivos generados y los correos preparados.
 */
async function emitirBoletas(trabajo, filas, directorio, resultado) {
    // Validación de la política de contraseña para las boletas
    if ((process.env.N8N_PDF_PASSWORD_MODE || 'DOCUMENTO') !== 'DOCUMENTO')
        throw new Error('Debe configurar una política de contraseña soportada para las boletas.');

    // Itera sobre cada fila para generar la boleta y preparar el correo
    for await (const fila of filas) {
        const nombre = `boleta-${fila.periodo}-${fila.planilla_id}.pdf`;
        const r = fila.resultado;

        // Genera la contraseña del propietario para el PDF usando HMAC con SHA-256
        const ownerPassword = createHmac('sha256', process.env.N8N_WEBHOOK_SECRET)
            .update(`pdf-owner:${fila.planilla_id}`)
            .digest('hex');

        // Política explícita del MVP: documento del colaborador. Nunca se incluye esa clave en el manifiesto.
        await generateBoletaPdf(
            fila.empresa,
            fila.cabecera,
            r,
            r,
            r,
            r,
            r,
            { periodo: fila.periodo },
            join(directorio, nombre),
            {
                userPassword: fila.cabecera.nro_documento,
                ownerPassword,
            }
        );

        // Agrega los metadatos del archivo PDF generado al resultado
        resultado.archivos.push(
            await metadatos(
                directorio,
                nombre,
                'application/pdf',
                fila.planilla_id
            )
        );

        // Prepara el correo electrónico con la boleta adjunta
        const correo = await prepararCorreo(
            directorio,
            `correo-${fila.planilla_id}.eml`,
            {
                to: fila.email,
                subject: `Boleta de pago ${fila.periodo}`,
                text: `Hola ${fila.cabecera.nombre_completo}.\n\nAdjuntamos tu boleta del periodo ${fila.periodo}.\nLa clave de apertura es tu número de documento, sin espacios.\n\n${fila.empresa.nombreEmpresa}`,
                attachments: [
                    {
                        filename: nombre,
                        path: join(directorio, nombre),
                        contentType: 'application/pdf',
                    },
                ],
            },
            fila.planilla_id
        );
        resultado.archivos.push(correo.archivo);
        resultado.correos.push(correo.correo);
    }
}

/**
 * Envía un correo de recuperación de contraseña.
 * @param {*} trabajo - El objeto de trabajo que contiene la información de la tarea.
 * @param {*} directorio - El directorio donde se guardarán los archivos generados.
 * @param {*} resultado - Un objeto donde se almacenarán los resultados de la tarea, incluyendo los archivos generados y los correos preparados.
 */
async function enviarRecuperacion(trabajo, directorio, resultado) {
    // Validación de la solicitud de recuperación de contraseña
    const solicitud = trabajo.solicitud;

    // Verifica si el token de recuperación ha expirado
    if (Date.parse(solicitud.expira_en) <= Date.now())
        throw new Error('El token expiró antes de preparar el correo.');
    
    // Valida el protocolo del enlace de recuperación
    const uri = new URL(solicitud.frontend_url);
    if (!['http:', 'https:'].includes(uri.protocol))
        throw new Error('El enlace de recuperación tiene un protocolo inválido.');

    // Agrega el token de recuperación como parámetro de búsqueda en la URL
    uri.searchParams.set('token', solicitud.token_recuperacion);
    
    // Prepara el correo electrónico de recuperación de contraseña
    const correo = await prepararCorreo(
        directorio,
        `restablecer-${trabajo.id}.eml`,
        {
            to: solicitud.email,
            subject: 'Restablecer contraseña - Planillas JYP',
            text: `Solicitaste restablecer tu contraseña.\n\nAbre el siguiente enlace:\n${uri.toString()}\n\nEl enlace es de un solo uso y vence a los 15 minutos de la solicitud. Si no lo solicitaste, ignora este mensaje.`,
        }
    );

    // Agrega el archivo del correo y la información del correo al resultado
    resultado.archivos.push(correo.archivo);
    resultado.correos.push(correo.correo);
}

module.exports = { emitirBoletas, enviarRecuperacion };
