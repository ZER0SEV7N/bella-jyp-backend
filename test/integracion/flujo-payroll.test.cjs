const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { entorno } = require('./entorno.fixture.cjs');
let contexto, app, base, redisCliente, token, ids;
const demo = require('../../pruebas-demo/datos-demo.json');
before(
    async () => {
        contexto = await entorno();
        Object.assign(process.env, contexto.env);
        const { NestFactory } = require('@nestjs/core');
        const { FastifyAdapter } = require('@nestjs/platform-fastify');
        const { AppModule } = require('../../dist/app.module');
        const {
            validateEnv,
        } = require('../../dist/common/config/env.validation');
        validateEnv(process.env);
        app = await NestFactory.create(AppModule, new FastifyAdapter(), {
            logger: false,
        });
        await app.register(require('@fastify/cookie'), {
            secret: process.env.COOKIE_SECRET,
        });
        await app.register(require('@fastify/multipart'));
        app.useGlobalFilters(
            new (require('../../dist/common/filters/rfc7807-exception.filter').Rfc7807ExceptionFilter)()
        );
        app.useGlobalInterceptors(
            new (require('../../dist/common/interceptors/transform-response.interceptors').TransformResponseInterceptor)()
        );
        await app.listen(0, '127.0.0.1');
        base = 'http://127.0.0.1:' + app.getHttpServer().address().port;
        redisCliente = app.get(
            require('../../dist/common/cls/redis.constants').REDIS_CLIENT
        );
    },
    { timeout: 180000 }
);
after(async () => {
    if (app) await app.close();
    if (redisCliente && redisCliente.status !== 'end')
        await redisCliente.quit();
    if (contexto) await contexto.cerrar();
});
async function api(method, ruta, body, status = 200) {
    const multipart = body instanceof FormData;
    const r = await fetch(base + ruta, {
        method,
        headers: {
            ...(token ? { authorization: 'Bearer ' + token } : {}),
            ...(!multipart && body
                ? { 'content-type': 'application/json' }
                : {}),
        },
        ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
    });
    const datos = await r.json();
    assert.equal(r.status, status, JSON.stringify(datos));
    return datos.data;
}
async function login(documento) {
    const r = await api('POST', '/api/v1/auth/login', {
        tipo_documento: 'DNI',
        nro_documento: documento,
        password: demo.password_publica,
    });
    token = r.accessToken;
    assert.ok(token);
}
test(
    'Asistencia HTTP: importa el Excel y aprueba las diez incidencias reales',
    async () => {
        // Arrange: usuario administrador de la BD efímera y archivo de marcaciones completo.
        await login('09900001');
        const form = new FormData();
        form.append(
            'archivo',
            new Blob([
                await readFile(
                    'pruebas-demo/excel/01-marcaciones-completas.xlsx'
                ),
            ]),
            'marcaciones.xlsx'
        );
        // Act: importar, generar resúmenes y aprobarlos mediante las rutas reales.
        const importacion = await api(
            'POST',
            '/api/v1/asistencia/importacion/importar-excel',
            form,
            201
        );
        const generado = await api(
            'POST',
            '/api/v1/asistencia/incidencias/generar-cierre',
            { periodo: demo.periodo, limite: 100 }
        );
        const aprobado = await api(
            'PATCH',
            '/api/v1/asistencia/incidencias/aprobar',
            { periodo: demo.periodo }
        );
        // Assert: datos originados por el motor; no se insertaron cálculos ficticios en SQL.
        assert.equal(importacion.insertadas, 880);
        assert.equal(generado.errores, 0);
        assert.equal(aprobado.registros_aprobados, 10);
    },
    { timeout: 60000 }
);
test(
    'Payroll HTTP: calcula una planilla individual y luego todo el grupo en BullMQ/Piscina',
    async () => {
        // Arrange: sesión de contador e incidencias aprobadas en el paso anterior del recorrido.
        await login('09900003');
        // Act: encolar y esperar dos trabajos reales sobre Redis y PostgreSQL nativos.
        for (const filtro of [{ empleado_id: demo.empleados[0].id }, {}]) {
            const job = await api(
                'POST',
                '/api/v1/payroll/planillas/generar',
                {
                    periodo: demo.periodo,
                    solicitud_id: require('node:crypto').randomUUID(),
                    ...filtro,
                },
                202
            );
            let estado;
            for (let n = 0; n < 120; n++) {
                estado = await api(
                    'GET',
                    '/api/v1/payroll/planillas/trabajos/' + job.trabajo_id
                );
                if (['completed', 'failed'].includes(estado.estado)) break;
                await new Promise((r) => setTimeout(r, 250));
            }
            assert.equal(estado.estado, 'completed', JSON.stringify(estado));
            assert.equal(estado.resultado.fallidos, 0);
        }
        const listado = await api(
            'GET',
            '/api/v1/payroll/planillas?periodo=2026-09&page=1&limit=100'
        );
        ids = listado.data.map((r) => r.id);
        // Assert: diez planillas calculadas y netos positivos en lugar de un resultado prefabricado.
        assert.equal(ids.length, 10);
        assert.ok(listado.data.every((r) => Number(r.neto_a_pagar) > 0));
    },
    { timeout: 60000 }
);
test(
    'Cierre HTTP: archiva diez intenciones de boleta sin ejecutar pagos ni correo externo',
    async () => {
        // Arrange: el contador obtiene las versiones vigentes de las planillas calculadas.
        const planillas = await Promise.all(
            ids.map((id) => api('GET', '/api/v1/payroll/planillas/' + id))
        );
        // Act: cerrar cada planilla por su endpoint, que comparte transacción con la bandeja de salida.
        for (const p of planillas) {
            const r = await api(
                'POST',
                '/api/v1/payroll/planillas/' + p.id + '/congelar',
                {
                    version: p.version,
                    motivo: 'Revisión de la demostración automática',
                },
                201
            );
            assert.ok(r.trabajo_boleta_id);
        }
        const r = await contexto.client.query(
            "SELECT count(*)::int AS total FROM integracion_trabajo WHERE tipo='BOLETAS'"
        );
        // Assert: un trabajo por cierre. El despacho usa un destino local inactivo para esta prueba.
        assert.equal(r.rows[0].total, 10);
    },
    { timeout: 60000 }
);
