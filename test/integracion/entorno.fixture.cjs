const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const { GenericContainer } = require('testcontainers');
const { Client } = require('pg');
const { readFile } = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
/** PostgreSQL/Redis nativos efímeros. No toma DATABASE_URL del desarrollador ni usa emuladores. */
async function entorno() {
    const pg = await new PostgreSqlContainer('postgres:17-alpine')
        .withDatabase('jyp_demo')
        .start();
    let redis;
    try {
        redis = await new GenericContainer('redis:7-alpine')
            .withExposedPorts(6379)
            .start();
    } catch (e) {
        await pg.stop();
        throw e;
    }
    const env = {
        ...process.env,
        DATABASE_URL: pg.getConnectionUri(),
        DIRECT_URL: pg.getConnectionUri(),
        REDIS_HOST: redis.getHost(),
        REDIS_PORT: String(redis.getMappedPort(6379)),
        NODE_ENV: 'test',
        JWT_ACCESS_SECRET: 'jwt-access-exclusivo-pruebas-2026',
        JWT_REFRESH_SECRET: 'jwt-refresh-exclusivo-pruebas-2026',
        COOKIE_SECRET: 'cookies-exclusivo-pruebas-2026',
        FINANCIAL_DATA_ENCRYPTION_KEY:
            'cifrado-exclusivo-pruebas-2026-no-produccion',
        EMPRESA_NOMBRE: 'EMPRESA DEMO',
        EMPRESA_RUC: '20000000001',
        EMPRESA_DIRECCION: 'Domicilio ficticio',
        N8N_WEBHOOK_URL_TRABAJOS: 'http://127.0.0.1:9/webhook-local-inactivo',
        N8N_WEBHOOK_SECRET: 'hmac-ficticio-solo-pruebas-2026-000000',
        FRONTEND_RESET_PASSWORD_URL:
            'http://localhost:5173/restablecer-password',
    };
    // La preparación no depende de las variables opcionales de una póliza real del desarrollador.
    env.DOTENV_CONFIG_PATH = require('node:path').resolve(
        __dirname,
        'sin-archivo-env.env'
    );
    for (const clave of [
        'SEED_VIDA_LEY_PCT',
        'SEED_VIDA_LEY_DESDE',
        'SEED_VIDA_LEY_HASTA',
    ])
        delete env[clave];
    const client = new Client({ connectionString: env.DATABASE_URL });
    await client.connect();
    async function comando(args) {
        const p = spawn(process.execPath, args, { env, stdio: 'inherit' });
        const [code] = await once(p, 'exit');
        if (code !== 0) throw new Error('Falló el comando de preparación.');
    }
    try {
        await client.query(await readFile('basededatos.sql', 'utf8'));
        await comando(['--import', 'tsx', 'prisma/seed.ts']);
        await client.query("SET app.entorno_pruebas='SI'");
        await client.query(
            await readFile('pruebas-demo/datosprueba.sql', 'utf8')
        );
    } catch (e) {
        await client.end();
        await redis.stop();
        await pg.stop();
        throw e;
    }
    return {
        env,
        client,
        async cerrar() {
            await client.end();
            await redis.stop();
            await pg.stop();
        },
    };
}
module.exports = { entorno };
