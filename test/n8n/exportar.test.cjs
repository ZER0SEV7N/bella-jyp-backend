const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { exportar } = require('../../n8n/tareas/exportar.cjs');
const {
    calcularPlanilla,
} = require('../../dist/modules/payroll/planillas/domain/calcular-planilla');
const demo = require('../../pruebas-demo/datos-demo.json');
const { fila } = require('../fixtures/exportacion-n8n.fixture.cjs');
async function* filas() {
    for (const e of demo.empleados) yield fila(e);
}
test('BCP: genera por streaming una cabecera y diez abonos con totales conciliados', async () => {
    // Arrange: nómina ficticia y directorio temporal exclusivo.
    const dir = await mkdtemp(join(tmpdir(), 'jyp-bcp-'));
    const configuracion = {
        fecha_pago: '2026-10-30',
        cuenta_cargo: '1910000000099',
        tipo_cuenta_cargo: 'C',
        referencia: 'HABERES DEMO',
        tipos_cuenta_abono: Object.fromEntries(
            demo.empleados.map((e) => [e.id, 'A'])
        ),
    };
    try {
        // Act: ejecutar el mismo generador que invoca n8n.
        const [archivo] = await exportar(
            {
                tipo: 'BCP_HABERES',
                periodo: demo.periodo,
                solicitud: { configuracion },
            },
            filas(),
            dir
        );
        const txt = await readFile(join(dir, archivo.nombre), 'latin1');
        const lineas = txt.trimEnd().split('\r\n');
        // Assert: 11 registros, anchos oficiales y centavos exactos en cabecera.
        assert.equal(lineas.length, 11);
        assert.equal(lineas[0].length, 113);
        assert.ok(lineas.slice(1).every((l) => l.length === 195));
        assert.equal(Number(lineas[0].slice(0, 7).slice(1)), 10);
        assert.equal(archivo.bytes, Buffer.byteLength(txt, 'latin1'));
        const sum = lineas
            .slice(1)
            .reduce(
                (s, l) => s + BigInt(l.slice(177, 194).replace('.', '')),
                0n
            );
        assert.equal(BigInt(lineas[0].slice(41, 58).replace('.', '')), sum);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
test('PLAME: conserva los seis campos de jornada y cinco de remuneración', async () => {
    // Arrange: diez trabajadores y pago confirmado para esta simulación local.
    const dir = await mkdtemp(join(tmpdir(), 'jyp-plame-'));
    try {
        // Act: generar los dos archivos separados de SUNAT.
        const archivos = await exportar(
            {
                tipo: 'PLAME',
                periodo: demo.periodo,
                solicitud: {
                    configuracion: { confirmar_montos_pagados: true },
                },
            },
            filas(),
            dir
        );
        // Assert: nombres oficiales por período/RUC, sin un formato bancario genérico.
        assert.equal(archivos.length, 2);
        for (const a of archivos) {
            const lineas = (await readFile(join(dir, a.nombre), 'latin1'))
                .trim()
                .split('\r\n');
            assert.ok(
                lineas.every(
                    (l) =>
                        l.split('|').length ===
                        (a.nombre.endsWith('.jor') ? 6 : 5)
                )
            );
            assert.match(a.nombre, /^060120260920000000001\.(jor|rem)$/);
        }
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
test('COSTOS: agrupa las tres áreas de la demostración', async () => {
    // Arrange: flujo de datos de diez empleados en tres áreas.
    const dir = await mkdtemp(join(tmpdir(), 'jyp-costos-'));
    try {
        // Act: resumir en el CSV local.
        const [archivo] = await exportar(
            {
                tipo: 'COSTOS',
                periodo: demo.periodo,
                solicitud: { configuracion: {} },
            },
            filas(),
            dir
        );
        const lineas = (await readFile(join(dir, archivo.nombre), 'utf8'))
            .trim()
            .split('\r\n');
        // Assert: una cabecera y tres grupos; la suma de empleados sigue siendo diez.
        assert.equal(lineas.length, 4);
        assert.equal(
            lineas.slice(1).reduce((s, l) => s + Number(l.split(',')[1]), 0),
            10
        );
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test('AFPnet: conserva también los dos espacios finales del código AFP opcional', async () => {
    // Arrange: cinco afiliados al SPP y clasificación de apellidos/aportes confirmada.
    const dir = await mkdtemp(join(tmpdir(), 'jyp-afpnet-'));
    const configuracion = {
        apellidos_afpnet: Object.fromEntries(
            demo.empleados.map((e) => [
                e.id,
                { paterno: e.paterno, materno: e.materno },
            ])
        ),
        aportes_voluntarios: Object.fromEntries(
            demo.empleados.map((e) => [
                e.id,
                { con_fin: '0', sin_fin: '0', empleador: '0' },
            ])
        ),
    };
    try {
        // Act: generar el archivo con el ejecutor real, filtrando ONP.
        const [archivo] = await exportar(
            {
                tipo: 'AFPNET',
                periodo: demo.periodo,
                solicitud: { configuracion },
            },
            filas(),
            dir
        );
        const texto = await readFile(join(dir, archivo.nombre), 'latin1');
        const lineas = texto.split('\r\n').filter(Boolean);
        // Assert: el separador final no debe usarse para recortar espacios significativos del registro.
        assert.equal(lineas.length, 5);
        assert.ok(lineas.every((l) => l.length === 141 && l.endsWith('  ')));
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test('COSTOS: descuenta tiempo no devengado y conserva pensiones como parte del salario', async () => {
    // Arrange: snapshot ficticio con cincuenta soles de falta y descuento previsional separado.
    const dir = await mkdtemp(join(tmpdir(), 'jyp-costos-tiempo-'));
    const registro = fila(demo.empleados[0]);
    registro.resultado.descuento_faltas = '50';
    registro.resultado.aporte_essalud = '130.5';
    registro.resultado.aporte_vida_ley = '1.45';
    try {
        // Act: resumir ese snapshot cerrado en el reporte interno.
        const [archivo] = await exportar(
            {
                tipo: 'COSTOS',
                periodo: demo.periodo,
                solicitud: { configuracion: {} },
            },
            (async function* () {
                yield registro;
            })(),
            dir
        );
        const [cabecera, linea] = (
            await readFile(join(dir, archivo.nombre), 'utf8')
        )
            .trim()
            .split('\r\n');
        const columnas = cabecera.split(',');
        const valores = linea.split(',');
        // Assert: costo = 1500 - 50 + 130.50 + 1.45; no se resta otra vez ONP.
        assert.equal(
            valores[columnas.indexOf('remuneracion_devengada')],
            '1450.00'
        );
        assert.equal(valores[columnas.indexOf('costo_empleador')], '1581.95');
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
