const nodemailer = require('nodemailer');
const { pipeline } = require('node:stream/promises');
const { createWriteStream } = require('node:fs');
const { join } = require('node:path');
const { metadatos } = require('./almacenamiento.cjs');

/** Siempre conserva el .eml local. SMTP solo se ejecuta cuando se configura expresamente ese modo. */
async function prepararCorreo(directorio, nombre, mensaje, planillaId) {
    const correo = {
        from: process.env.SMTP_FROM || 'planillas@example.test',
        ...mensaje,
    };
    const transporteLocal = nodemailer.createTransport({
        streamTransport: true,
        buffer: false,
        newline: 'windows',
    });
    const preparado = await transporteLocal.sendMail(correo);
    await pipeline(
        preparado.message,
        createWriteStream(join(directorio, nombre), {
            flags: 'wx',
            mode: 0o600,
        })
    );
    const archivo = await metadatos(
        directorio,
        nombre,
        'message/rfc822',
        planillaId
    );
    const modo = process.env.N8N_CORREOS_MODO || 'LOCAL';
    if (modo === 'LOCAL')
        return {
            archivo,
            correo: {
                ...(planillaId ? { planilla_id: planillaId } : {}),
                estado: 'GUARDADO_LOCAL',
            },
        };
    if (modo !== 'SMTP')
        throw new Error('N8N_CORREOS_MODO debe ser LOCAL o SMTP.');
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
    try {
        // Se transmite exactamente el correo que quedó archivado. No se vuelve a construir el adjunto.
        const enviado = await smtp.sendMail({
            envelope: preparado.envelope,
            raw: { path: join(directorio, nombre) },
        });
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
