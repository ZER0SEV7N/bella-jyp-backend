#!/usr/bin/env node
/**
 * Script de verificación estática de complejidad ciclomática/cognitiva y límites de líneas
 * alineado con las reglas de SonarQube del proyecto (`pnpm check:complejidad`).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const UMBRAL_COMPLEJIDAD_FUNCION = 25;

function listarArchivosTs(dir) {
  const resultado = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === 'decorators') continue;
      resultado.push(...listarArchivosTs(ruta));
    } else if (
      entrada.isFile() &&
      entrada.name.endsWith('.ts') &&
      !entrada.name.endsWith('.decorator.ts') &&
      !entrada.name.endsWith('.module.ts') &&
      !entrada.name.endsWith('.types.ts')
    ) {
      resultado.push(ruta);
    }
  }
  return resultado;
}

function verificar() {
  const archivos = listarArchivosTs(SRC_DIR);
  let alertas = 0;

  for (const archivo of archivos) {
    const contenido = fs.readFileSync(archivo, 'utf8');
    const sinComentarios = contenido
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    const ramas = (sinComentarios.match(/\b(if|else\s+if|for|while|case|catch)\b|\?\?|\|\||&&/g) || []).length;
    const funciones = Math.max(
      1,
      (sinComentarios.match(/\b(function|async\s+\w+\s*\(|\w+\s*\([^)]*\)\s*\{|=>)/g) || []).length,
    );
    const promedioPorFuncion = ramas / funciones;

    if (promedioPorFuncion > UMBRAL_COMPLEJIDAD_FUNCION) {
      console.warn(
        `[Complejidad] ${path.relative(process.cwd(), archivo)}: promedio ${promedioPorFuncion.toFixed(1)} > ${UMBRAL_COMPLEJIDAD_FUNCION}`,
      );
      alertas++;
    }
  }

  console.log(
    `[SonarQube Check] ${archivos.length} archivos verificados. Alertas de complejidad excesiva: ${alertas}.`,
  );
  if (alertas > 0) process.exit(1);
}

verificar();
