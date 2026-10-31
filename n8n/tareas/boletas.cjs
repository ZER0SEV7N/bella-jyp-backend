const { join } = require('node:path');
const { createHmac } = require('node:crypto');
const {
    generateBoletaPdf,
} = require('../../dist/modules/payroll/planillas/helpers/generarBoleta.helper');
const { metadatos } = require('./almacenamiento.cjs');
const { prepararCorreo } = require('./correos.cjs');

/** CU-24 y CU-33: renderizado fuera de NestJS, archivo protegido e historial de despacho. */
async function emitirBoletas(trabajo, filas, directorio, resultado) {
    if ((process.env.N8N_PDF_PASSWORD_MODE || 'DOCUMENTO') !== 'DOCUMENTO')
        throw new Error(
            'Debe configurar una política de contraseña soportada para las boletas.'
        );
    for await (const fila of filas) {
        const nombre = `boleta-${fila.periodo}-${fila.planilla_id}.pdf`;
        const r = fila.resultado;
        const ownerPassword = createHmac(
            'sha256',
            process.env.N8N_WEBHOOK_SECRET
        )
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
        resultado.archivos.push(
            await metadatos(
                directorio,
                nombre,
                'application/pdf',
                fila.planilla_id
            )
        );
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

async function enviarRecuperacion(trabajo, directorio, resultado) {
    const solicitud = trabajo.solicitud;
    if (Date.parse(solicitud.expira_en) <= Date.now())
        throw new Error('El token expiró antes de preparar el correo.');
    const uri = new URL(solicitud.frontend_url);
    if (!['http:', 'https:'].includes(uri.protocol))
        throw new Error(
            'El enlace de recuperación tiene un protocolo inválido.'
        );
    uri.searchParams.set('token', solicitud.token_recuperacion);
    const correo = await prepararCorreo(
        directorio,
        `restablecer-${trabajo.id}.eml`,
        {
            to: solicitud.email,
            subject: 'Restablecer contraseña - Planillas JYP',
            text: `Solicitaste restablecer tu contraseña.\n\nAbre el siguiente enlace:\n${uri.toString()}\n\nEl enlace es de un solo uso y vence a los 15 minutos de la solicitud. Si no lo solicitaste, ignora este mensaje.`,
        }
    );
    resultado.archivos.push(correo.archivo);
    resultado.correos.push(correo.correo);
}

module.exports = { emitirBoletas, enviarRecuperacion };
