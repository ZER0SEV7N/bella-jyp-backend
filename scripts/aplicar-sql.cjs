#!/usr/bin/env node
/**
 * Script operativo para aplicar los archivos SQL de base de datos usando el driver `pg` y `dotenv`.
 * Resuelve los comandos de package.json:
 *   - `pnpm db:crear`             -> node scripts/aplicar-sql.cjs crear
 *   - `pnpm db:instalar-objetos`  -> node scripts/aplicar-sql.cjs objetos
 *   - `pnpm db:demo`              -> node scripts/aplicar-sql.cjs demo
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const MODO = (process.argv[2] || 'demo').toLowerCase();

const ARCHIVOS_POR_MODO = {
  crear: [path.resolve(__dirname, 'basededatos.sql')],
  objetos: [path.resolve(__dirname, '..', 'prisma', 'asistencia-payroll-instalar-objetos.sql')],
  demo: [
    path.resolve(__dirname, '..', 'prisma', 'asistencia-payroll-instalar-objetos.sql'),
    path.resolve(__dirname, 'datosprueba.sql'),
  ],
  'demo-10': [
    path.resolve(__dirname, '..', 'prisma', 'asistencia-payroll-instalar-objetos.sql'),
    path.resolve(__dirname, 'pruebas-demo', 'datosprueba.sql'),
  ],
};

async function ejecutar() {
  const rutas = ARCHIVOS_POR_MODO[MODO];
  if (!rutas) {
    console.error(`Modo no reconocido: "${MODO}". Use: crear | objetos | demo | demo-10`);
    process.exit(1);
  }

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: Defina DATABASE_URL en su archivo .env antes de ejecutar este comando.');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("SET client_encoding = 'UTF8';");
    await client.query("SET app.entorno_pruebas = 'SI';");

    for (const ruta of rutas) {
      if (!fs.existsSync(ruta)) {
        throw new Error(`No se encontró el archivo SQL requerido: ${ruta}`);
      }
      const sql = fs.readFileSync(ruta, 'utf8');
      console.log(`[SQL] Ejecutando: ${path.relative(process.cwd(), ruta)} ...`);
      await client.query(sql);
      console.log(`[SQL] Completado exitosamente: ${path.basename(ruta)}`);
    }
  } finally {
    await client.end();
  }
}

ejecutar().catch((err) => {
  console.error('[SQL] Error al aplicar script SQL:', err.message);
  process.exit(1);
});
