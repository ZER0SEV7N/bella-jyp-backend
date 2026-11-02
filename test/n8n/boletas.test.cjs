const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { fila } = require('../fixtures/exportacion-n8n.fixture.cjs');
const demo = require('../../pruebas-demo/datos-demo.json');
const {
    emitirBoletas,
    enviarRecuperacion,
} = require('../../n8n/tareas/boletas.cjs');
test('Boleta: archiva el PDF protegido y lo adjunta al correo local', async () => {
    // Arrange: un empleado ficticio, directorio aislado y envío externo desactivado.
    const dir = await mkdtemp(join(tmpdir(), 'jyp-pdf-'));
    process.env.N8N_CORREOS_MODO = 'LOCAL';
    process.env.N8N_WEBHOOK_SECRET = 'clave-ficticia-solo-pruebas-de-pdf';
    process.env.SMTP_FROM = 'planillas@example.test';
    const datos = fila(demo.empleados[0]),
        resultado = { archivos: [], correos: [] };
    try {
        // Act: invocar el emisor utilizado por el workflow n8n.
        await emitirBoletas(
            { periodo: demo.periodo },
            (async function* () {
                yield datos;
            })(),
            dir,
            resultado
        );
        // Assert: PDF cifrado, adjunto MIME y estados sin afirmar entrega al colaborador.
        const pdf = resultado.archivos.find(
            (a) => a.tipo === 'application/pdf'
        );
        assert.ok(pdf);
        assert.match(
            (await readFile(join(dir, pdf.nombre))).toString('latin1'),
            /\/Encrypt\s/
        );
        const eml = resultado.archivos.find((a) => a.tipo === 'message/rfc822');
        assert.match(
            await readFile(join(dir, eml.nombre), 'utf8'),
            /application\/pdf/
        );
        assert.equal(resultado.correos[0].estado, 'GUARDADO_LOCAL');
        assert.equal(
            JSON.stringify(resultado).includes(datos.cabecera.nro_documento),
            false
        );
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
test('Recuperación: un enlace vencido no se guarda ni se envía', async () => {
    // Arrange: token ya vencido y un destinatario ficticio.
    const dir = await mkdtemp(join(tmpdir(), 'jyp-reset-'));
    const resultado = { archivos: [], correos: [] };
    try {
        // Act: intentar preparar un correo de recuperación fuera de su vigencia.
        const operacion = enviarRecuperacion(
            { solicitud: { expira_en: '2020-01-01T00:00:00Z' } },
            dir,
            resultado
        );
        // Assert: no se presenta al usuario un enlace que ya no puede usar.
        await assert.rejects(operacion, /expiró/);
        assert.equal(resultado.archivos.length, 0);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
