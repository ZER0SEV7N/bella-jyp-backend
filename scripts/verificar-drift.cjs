#!/usr/bin/env node
/**
 * Guard de deriva del esquema (INT-F3).
 *
 * Motivo: `IntegracionTrabajo` existió en prisma/schema.prisma sin migración y nadie lo detectó.
 * En una base nueva eso rompía la exportación a n8n con P2021 (tabla inexistente).
 *
 * El proyecto tiene dos rutas de instalación y este script valida ambas:
 *   1. `scripts/basededatos.sql` — instalación completa (`pnpm db:crear`); es la fuente canónica del esquema.
 *   2. `prisma/migrations/**`     — migraciones incrementales sobre una base ya instalada.
 *
 * Comprobaciones estructurales (sin base de datos):
 *   - Todo modelo/enum de Prisma debe existir en `scripts/basededatos.sql`.
 *   - Toda tabla/tipo creado por una migración debe existir en `prisma/schema.prisma` (evita migraciones huérfanas).
 *   - Los índices que Prisma no modela deben seguir presentes.
 *
 * Uso:
 *   node scripts/verificar-drift.cjs              # chequeo estructural, sin base de datos
 *   node scripts/verificar-drift.cjs --completo   # además ejecuta `prisma migrate diff` (requiere SHADOW_DATABASE_URL)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..');
const SCHEMA = path.join(RAIZ, 'prisma', 'schema.prisma');
const MIGRACIONES = path.join(RAIZ, 'prisma', 'migrations');
const SQL_INSTALACION = path.join(RAIZ, 'scripts', 'basededatos.sql');

/** Índices parciales que Prisma no modela y que ninguna migración debe borrar. */
const INDICES_NO_MODELADOS = ['uq_novedad_dso_aprobada'];

/** Lee y concatena todas las migraciones SQL. */
function leerMigraciones() {
  if (!fs.existsSync(MIGRACIONES)) return '';
  return fs
    .readdirSync(MIGRACIONES, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => path.join(MIGRACIONES, entrada.name, 'migration.sql'))
    .filter((archivo) => fs.existsSync(archivo))
    .map((archivo) => fs.readFileSync(archivo, 'utf8'))
    .join('\n');
}

/** Extrae los modelos del esquema Prisma con su tabla física (`@@map` o nombre del modelo). */
function leerModelos(schema) {
  return [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map(([, nombre, cuerpo]) => ({
    nombre,
    tabla: (cuerpo.match(/@@map\("(\w+)"\)/) || [])[1] || nombre,
  }));
}

/** Extrae los enums nativos declarados en el esquema Prisma. */
function leerEnums(schema) {
  return [...schema.matchAll(/^enum\s+(\w+)\s*\{/gm)].map(([, nombre]) => nombre);
}

/** Devuelve los nombres de tabla creados por un texto SQL. */
function tablasCreadas(sql) {
  return [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"(\w+)"/gi)].map(([, tabla]) => tabla);
}

/** Devuelve los nombres de tipo enumerado creados por un texto SQL. */
function tiposCreados(sql) {
  return [...sql.matchAll(/CREATE\s+TYPE\s+"(\w+)"/gi)].map(([, tipo]) => tipo);
}

/** Ejecuta el chequeo estructural y devuelve la lista de problemas encontrados. */
function verificarEstructura() {
  const schema = fs.readFileSync(SCHEMA, 'utf8');
  const migraciones = leerMigraciones();
  const instalacion = fs.readFileSync(SQL_INSTALACION, 'utf8');

  const modelos = leerModelos(schema);
  const enums = leerEnums(schema);

  const tablasInstalacion = new Set(tablasCreadas(instalacion));
  const tiposInstalacion = new Set(tiposCreados(instalacion));
  const tablasMigradas = tablasCreadas(migraciones);
  const tiposMigrados = tiposCreados(migraciones);

  const problemas = [];

  //1. La instalación completa debe cubrir todo el modelo Prisma.
  for (const { nombre, tabla } of modelos) {
    if (!tablasInstalacion.has(tabla)) {
      problemas.push(`Modelo ${nombre}: falta CREATE TABLE "${tabla}" en scripts/basededatos.sql.`);
    }
  }

  for (const tipo of enums) {
    if (!tiposInstalacion.has(tipo)) {
      problemas.push(`Enum ${tipo}: falta CREATE TYPE en scripts/basededatos.sql.`);
    }
  }

  //2. Ninguna migración debe crear tablas o tipos que el modelo Prisma ya no declara.
  const tablasModeladas = new Set(modelos.map((modelo) => modelo.tabla));
  const enumsModelados = new Set(enums);

  for (const tabla of tablasMigradas) {
    if (!tablasModeladas.has(tabla)) {
      problemas.push(`Migración huérfana: crea "${tabla}", que no existe en prisma/schema.prisma.`);
    }
  }

  for (const tipo of tiposMigrados) {
    if (!enumsModelados.has(tipo)) {
      problemas.push(`Migración huérfana: crea el enum "${tipo}", que no existe en prisma/schema.prisma.`);
    }
  }

  //3. Guardarraíl explícito: si alguien regenera basededatos.sql desde Prisma, este índice desaparece.
  for (const indice of INDICES_NO_MODELADOS) {
    if (!instalacion.includes(indice)) {
      problemas.push(`Falta el índice no modelado "${indice}" en scripts/basededatos.sql.`);
    }
  }

  return { problemas, modelos: modelos.length, enums: enums.length };
}

/** Ejecuta `prisma migrate diff` contra una base sombra (requiere SHADOW_DATABASE_URL). */
function verificarConBaseSombra() {
  const sombra = process.env.SHADOW_DATABASE_URL;
  if (!sombra) {
    console.error('--completo requiere la variable SHADOW_DATABASE_URL (base vacía y desechable).');
    return 1;
  }

  const ejecutable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const argumentos = [
    'prisma',
    'migrate',
    'diff',
    '--from-migrations',
    'prisma/migrations',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--shadow-database-url',
    sombra,
    '--exit-code',
  ];

  try {
    execFileSync(ejecutable, argumentos, { cwd: RAIZ, stdio: 'inherit' });
    console.log('Prisma migrate diff: sin diferencias.');
    return 0;
  } catch (error) {
    //Código 2 de `prisma migrate diff --exit-code` significa "hay diferencias".
    if (error.status === 2) {
      console.error('Prisma migrate diff detectó diferencias entre las migraciones y schema.prisma.');
      return 1;
    }
    console.error('No se pudo ejecutar Prisma migrate diff:', error.message);
    return 1;
  }
}

function main() {
  const { problemas, modelos, enums } = verificarEstructura();

  if (problemas.length) {
    console.error('Deriva de esquema detectada:\n');
    for (const problema of problemas) console.error(`  - ${problema}`);
    console.error('\nAgregue la migración correspondiente y actualice scripts/basededatos.sql.');
    process.exit(1);
  }

  console.log(`Esquema consistente: ${modelos} modelos y ${enums} enums verificados.`);

  if (process.argv.includes('--completo')) process.exit(verificarConBaseSombra());
}

main();
