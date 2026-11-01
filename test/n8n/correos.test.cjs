const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const nodemailer = require('nodemailer');
const { prepararCorreo } = require('../../n8n/tareas/correos.cjs');
test('LOCAL: archiva un MIME sin abrir una conexión SMTP', async () => {
    // Arrange: correo y destinatario completamente ficticios.
    const dir = await mkdtemp(join(tmpdir(), 'jyp-email-'));
    process.env.N8N_CORREOS_MODO = 'LOCAL';
    process.env.SMTP_FROM = 'planillas@example.test';
    try {
        // Act: preparar el correo local.
        const r = await prepararCorreo(dir, 'correo.eml', {
            to: 'persona@example.test',
            subject: 'Boleta de prueba',
            text: 'Contenido ficticio',
        });
        const mime = await readFile(join(dir, 'correo.eml'), 'utf8');
        // Assert: dirección y contenido se conservan; no se informa entrega SMTP.
        assert.equal(r.correo.estado, 'GUARDADO_LOCAL');
        assert.match(mime, /persona@example.test/);
        assert.match(mime, /Contenido ficticio/);
        assert.equal(r.archivo.tipo, 'message/rfc822');
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
test('SMTP: transmite el MIME archivado y distingue aceptación de entrega', async () => {
    // Arrange: transporte SMTP simulado; el transporte de MIME sigue siendo real.
    const dir = await mkdtemp(join(tmpdir(), 'jyp-smtp-'));
    process.env.N8N_CORREOS_MODO = 'SMTP';
    const original = nodemailer.createTransport;
    const enviados = [];
    const espia = mock.method(nodemailer, 'createTransport', (config) =>
        config.streamTransport
            ? original(config)
            : {
                  sendMail: async (m) => {
                      enviados.push(m);
                      return { messageId: 'id-ficticio' };
                  },
                  close: () => {},
              }
    );
    try {
        // Act: preparar y despachar sin ningún servicio externo.
        const r = await prepararCorreo(dir, 'correo.eml', {
            to: 'persona@example.test',
            subject: 'Prueba',
            text: 'Texto de prueba',
        });
        // Assert: envío por ruta del MIME, estado aceptado y ninguna afirmación de recepción final.
        assert.equal(r.correo.estado, 'ACEPTADO_SMTP');
        assert.equal(enviados[0].raw.path, join(dir, 'correo.eml'));
        assert.equal(r.correo.message_id, 'id-ficticio');
    } finally {
        espia.mock.restore();
        await rm(dir, { recursive: true, force: true });
    }
});
