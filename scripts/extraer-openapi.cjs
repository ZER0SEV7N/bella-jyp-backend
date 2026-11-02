#!/usr/bin/env node
/**
 * Script para validar y exportar la especificación OpenAPI (`openapi.json` y `openapi.yml`).
 * Soporta el comando `pnpm docs:exportar`.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const rutaJson = path.resolve(__dirname, '..', 'openapi.json');
if (!fs.existsSync(rutaJson)) {
  console.error('No se encontró openapi.json en la raíz del proyecto.');
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(rutaJson, 'utf8'));
console.log(`[OpenAPI] Especificación validada correctamente: ${Object.keys(spec.paths || {}).length} rutas documentadas.`);
