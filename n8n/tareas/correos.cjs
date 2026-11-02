//n8n/tareas/correos.cjs
const nodemailer = require('nodemailer');
const { pipeline } = require('node:stream/promises');
const { createWriteStream } = require('node:fs');
const { join } = require('node:path');
const { metadatos } = require('./almacenamiento.cjs');

/**
 * Tarea que prepara un correo electrónico para ser enviado.
 * Su utilidad es generar un archivo de correo electrónico en formato RFC 822 (message/rfc822) que puede ser enviado posteriormente a través de un servidor SMTP o almacenado localmente.
 * Las funciones son:
 * - prepararCorreo: Prepara un correo electrónico con los detalles proporcionados y genera un archivo del correo en el directorio especificado.
 */

/**
 * Prepara un correo electrónico para ser enviado.  
 * @param {*} directorio - El directorio donde se guardará el archivo del correo.
 * @param {*} nombre - El nombre del archivo del correo.
 * @param {*} mensaje - El objeto que contiene los detalles del correo (destinatario, asunto, cuerpo, etc.).
 * @param {*} planillaId - El ID de la planilla asociada al correo (opcional).
 * @returns - {Promise<{archivo: *, correo: *}>} - Un objeto que contiene los metadatos del archivo del correo y la información del correo preparado.
 */
async function prepararCorreo(directorio, nombre, mensaje, planillaId) {
    // Configura el correo electrónico con los detalles proporcionados y el remitente predeterminado
    const correo = {
        from: process.env.SMTP_FROM || 'planillas@example.test',
        ...mensaje,
    };

    // Crea un transporte de correo local para generar el archivo del correo sin enviarlo
    const transporteLocal = nodemailer.createTransport({
        streamTransport: true,
        buffer: false,
        newline: 'windows',
    });

    // Envía el correo utilizando el transporte local y guarda el archivo del correo en el directorio especificado
    const preparado = await transporteLocal.sendMail(correo);
    await pipeline(
        preparado.message,
        createWriteStream(join(directorio, nombre), {
            flags: 'wx',
            mode: 0o600,
        })
    );

    // Obtiene los metadatos del archivo del correo generado
    const archivo = await metadatos(
        directorio,
        nombre,
        'message/rfc822',
        planillaId
    );

    // Determina el modo de envío de correos (LOCAL o SMTP) y maneja el envío del correo según la configuración
    const modo = process.env.N8N_CORREOS_MODO || 'LOCAL';
    if (modo === 'LOCAL')
        return {
            archivo,
            correo: {
                ...(planillaId ? { planilla_id: planillaId } : {}),
                estado: 'GUARDADO_LOCAL',
            },
        };

    // Configura el transporte SMTP para enviar el correo a través de un servidor SMTP
    if (modo !== 'SMTP')
        throw new Error('N8N_CORREOS_MODO debe ser LOCAL o SMTP.');

    // Configura el transporte SMTP con los detalles del servidor y las credenciales de autenticación
    const smtp = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'mailpit',
        port: Number(process.env.SMTP_PORT || 1025),
        secure: process.env.SMTP_SECURE === 'true',
        requireTLS: process.env.SMTP_REQUIRE_TLS === 'true',
        ...(process.env.SMTP_USER
            ? {
                  auth: {
                      user: process.env.SMTP_USER,
                      pass: process.env.SMTP_PASSWORD,
                  },
              }
            : {}),
        connectionTimeout: 10000,
        socketTimeout: 20000,
    });

    // Intenta enviar el correo a través del transporte SMTP y maneja posibles errores durante el envío
    try {
        // Se transmite exactamente el correo que quedó archivado. No se vuelve a construir el adjunto.
        const enviado = await smtp.sendMail({
            envelope: preparado.envelope,
            raw: { path: join(directorio, nombre) },
        });

        // Devuelve los metadatos del archivo del correo y la información del correo enviado con el estado "ACEPTADO_SMTP"
        return {
            archivo,
            correo: {
                ...(planillaId ? { planilla_id: planillaId } : {}),
                estado: 'ACEPTADO_SMTP',
                message_id: enviado.messageId,
            },
        };
    } catch {
        // Un timeout posterior a DATA puede ocurrir después de aceptar el correo. No se reenvía automáticamente.
        return {
            archivo,
            correo: {
                ...(planillaId ? { planilla_id: planillaId } : {}),
                estado: 'INDETERMINADO',
            },
        };
    } finally {
        smtp.close();
    }
}

module.exports = { prepararCorreo };
