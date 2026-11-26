// src/modules/RRHH/organizacion/use-cases/carga-masiva/helpers/catalogos-carga-masiva.helper.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import type {
  area,
  bancos,
  cargo,
  jornada,
  regimen_pension,
  tipo_afp,
  tipo_documento,
} from '@prisma/client';

/**
 * Catálogos resueltos una única vez por job de carga masiva, indexados por nombre en minúsculas.
 * Evita el patrón N+1: antes se consultaba `tipo_documento`, `area`, `cargo`, `jornada`, `régimen`,
 * AFP y bancos por cada fila. Con este contexto cada fila solo lee de memoria.
 */
export interface ContextoCatalogosCargaMasiva {
  tipoDocumento: Map<string, tipo_documento>;
  area: Map<string, area>;
  /** Clave compuesta `${areaId}::${nombre.toLowerCase()}` porque el cargo pertenece a un área. */
  cargo: Map<string, cargo>;
  jornada: Map<string, Pick<jornada, 'id'>>;
  regimenOnp: regimen_pension | null;
  regimenAfp: regimen_pension | null;
  tipoAfp: Map<string, tipo_afp>;
  banco: Map<string, bancos>;
}

/**
 * Devuelve los nombres únicos (recortados y conservando el caso de la primera aparición) para
 * resolver cada catálogo una sola vez y crear áreas/cargos con el nombre original.
 */
function nombresUnicos(valores: Array<string | null | undefined>): string[] {
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const valor of valores) {
    if (!valor) continue;
    const limpio = valor.trim();
    const clave = limpio.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    resultado.push(limpio);
  }
  return resultado;
}

/**
 * Resuelve y precarga todos los catálogos que necesita la carga masiva.
 * Las áreas y cargos que no existen se crean de forma atómica aquí (en serie), de modo que el
 * procesamiento en paralelo de las filas no pueda duplicarlos por una condición de carrera.
 * @param prisma - Servicio de base de datos.
 * @param registros - Filas del archivo de carga masiva.
 * @returns - Contexto con los catálogos indexados para consulta en memoria.
 */
export async function prepararCatalogosCargaMasiva(
  prisma: PrismaService,
  registros: CargaMasivaFilaDTO[]
): Promise<ContextoCatalogosCargaMasiva> {
  // 1. Tipos de documento (solo lectura).
  const tipoDocumento = new Map<string, tipo_documento>();
  for (const nombre of nombresUnicos(registros.map((r) => r.tipo_documento))) {
    const encontrado = await prisma.tipo_documento.findFirst({
      where: { tipo_documento: { equals: nombre, mode: 'insensitive' } },
    });
    if (encontrado) tipoDocumento.set(nombre.toLowerCase(), encontrado);
  }

  // 2. Áreas: se resuelven y crean (si faltan) antes que los cargos.
  const area = new Map<string, area>();
  for (const nombre of nombresUnicos(registros.map((r) => r.area))) {
    let encontrada = await prisma.area.findFirst({
      where: {
        nombre: { equals: nombre, mode: 'insensitive' },
        deleted_at: null,
      },
    });
    if (!encontrada) {
      encontrada = await prisma.area.create({
        data: {
          id: IdentityGenerator.generateId(),
          nombre,
          descripcion: 'Área creada automáticamente vía Carga Masiva',
          activo: true,
        },
      });
    }
    area.set(nombre.toLowerCase(), encontrada);
  }

  // 3. Cargos: dependen del área ya resuelta.
  const cargo = new Map<string, cargo>();
  for (const registro of registros) {
    const areaResuelta = area.get(registro.area.trim().toLowerCase());
    if (!areaResuelta) continue;
    const nombre = registro.cargo.trim();
    const clave = `${areaResuelta.id}::${nombre.toLowerCase()}`;
    if (cargo.has(clave)) continue;

    let encontrado = await prisma.cargo.findFirst({
      where: {
        nombre: { equals: nombre, mode: 'insensitive' },
        id_area: areaResuelta.id,
        deleted_at: null,
      },
    });
    if (!encontrado) {
      encontrado = await prisma.cargo.create({
        data: {
          id: IdentityGenerator.generateId(),
          id_area: areaResuelta.id,
          nombre,
          descripcion: 'Cargo creado automáticamente vía Carga Masiva',
          sueldo_minimo: 1130.0,
          activo: true,
        },
      });
    }
    cargo.set(clave, encontrado);
  }

  // 4. Jornadas (solo lectura, sin creación).
  const jornada = new Map<string, Pick<jornada, 'id'>>();
  for (const nombre of nombresUnicos(registros.map((r) => r.jornada))) {
    const encontrada = await prisma.jornada.findFirst({
      where: {
        nombre: { equals: nombre, mode: 'insensitive' },
        deleted_at: null,
      },
      select: { id: true },
    });
    if (encontrada) jornada.set(nombre.toLowerCase(), encontrada);
  }

  // 5. Regímenes pensionarios: ONP y AFP/SPP se resuelven una vez.
  const regimenOnp = await prisma.regimen_pension.findFirst({
    where: { nombre: { in: ['ONP'], mode: 'insensitive' } },
  });
  const regimenAfp = await prisma.regimen_pension.findFirst({
    where: { nombre: { in: ['AFP', 'SPP'], mode: 'insensitive' } },
  });

  // 6. AFP (solo lectura).
  const tipoAfp = new Map<string, tipo_afp>();
  for (const nombre of nombresUnicos(
    registros.filter((r) => r.regimen_pension === 'AFP').map((r) => r.tipo_afp)
  )) {
    const encontrada = await prisma.tipo_afp.findFirst({
      where: { nombre: { contains: nombre, mode: 'insensitive' } },
    });
    if (encontrada) tipoAfp.set(nombre.toLowerCase(), encontrada);
  }

  // 7. Bancos de sueldo y CTS (solo lectura).
  const banco = new Map<string, bancos>();
  for (const nombre of nombresUnicos([
    ...registros.map((r) => r.banco_sueldo),
    ...registros.map((r) => r.banco_cts),
  ])) {
    const encontrado = await prisma.bancos.findFirst({
      where: { nombre: { contains: nombre, mode: 'insensitive' } },
    });
    if (encontrado) banco.set(nombre.toLowerCase(), encontrado);
  }

  return {
    tipoDocumento,
    area,
    cargo,
    jornada,
    regimenOnp,
    regimenAfp,
    tipoAfp,
    banco,
  };
}
