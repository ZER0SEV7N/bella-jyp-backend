const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { entorno } = require('./entorno.fixture.cjs');
let contexto;
before(
    async () => {
        contexto = await entorno();
    },
    { timeout: 180000 }
);
after(async () => {
    if (contexto) await contexto.cerrar();
});
test('SQL: instala diez empleados completos sin planillas precalculadas', async () => {
    // Arrange: esquema, protecciones, catálogos y SQL demo en PostgreSQL real.
    const client = contexto.client;
    // Act: consultar la población y los cálculos existentes.
    const e = await client.query(
        'SELECT count(*)::int AS total FROM empleados'
    );
    const p = await client.query(
        'SELECT count(*)::int AS total FROM historial_planillas'
    );
    // Assert: el motor se prueba después desde la API; no se falsean resultados en SQL.
    assert.equal(e.rows[0].total, 10);
    assert.equal(p.rows[0].total, 0);
});
test('Outbox: solo un ejecutor reclama el mismo trabajo', async () => {
    // Arrange: trabajo pendiente que dos procesos intentarán tomar.
    const client = contexto.client,
        id = '019a0000-0010-7000-8000-000000000001';
    await client.query(
        "INSERT INTO integracion_trabajo(id,clave,tipo,solicitud_cifrada,planilla_ids,actualizado_en) VALUES ($1,'concurrencia-demo','COSTOS','solo-fixture','{}',now())",
        [id]
    );
    // Act: dos actualizaciones condicionadas independientes.
    const a = await client.query(
        "UPDATE integracion_trabajo SET estado='PROCESANDO' WHERE id=$1 AND estado='PENDIENTE'",
        [id]
    );
    const b = await client.query(
        "UPDATE integracion_trabajo SET estado='PROCESANDO' WHERE id=$1 AND estado='PENDIENTE'",
        [id]
    );
    // Assert: la base concede una ejecución y la segunda no obtiene filas.
    assert.equal(a.rowCount, 1);
    assert.equal(b.rowCount, 0);
});
test('Outbox: una intención desaparece si se revierte su transacción', async () => {
    // Arrange: transacción nueva que agrega un trabajo y luego falla.
    const client = contexto.client,
        id = '019a0000-0010-7000-8000-000000000002';
    await client.query('BEGIN');
    // Act: simular una excepción posterior a la escritura de la bandeja.
    await client.query(
        "INSERT INTO integracion_trabajo(id,clave,tipo,solicitud_cifrada,planilla_ids,actualizado_en) VALUES ($1,'reversion-demo','BOLETAS','solo-fixture','{}',now())",
        [id]
    );
    await client.query('ROLLBACK');
    // Assert: no existe intención huérfana tras revertir la unidad de trabajo.
    const r = await client.query(
        'SELECT id FROM integracion_trabajo WHERE id=$1',
        [id]
    );
    assert.equal(r.rowCount, 0);
});
