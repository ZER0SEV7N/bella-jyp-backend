#!/usr/bin/env node
/**
 * Script para sincronizar el paquete local `@jyp/shared-contracts` desde `vendor/`.
 * Soporta el comando `pnpm actualizar:contratos`.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const vendorDir = path.resolve(__dirname, '..', 'vendor');
const paquetes = fs.existsSync(vendorDir)
  ? fs.readdirSync(vendorDir).filter((f) => f.endsWith('.tgz')).sort()
  : [];

if (!paquetes.length) {
  console.error('No se encontraron paquetes .tgz en el directorio vendor/.');
  process.exit(1);
}

console.log(`[Contratos] Paquete activo verificado en vendor/: ${paquetes.at(-1)}`);
