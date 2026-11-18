//src/modules/core/audit/helpers/resolver-nombres-auditoria.helper.ts
import type { PrismaService } from '@/common/prisma/prisma.service';
import {
  TABLAS_AUDITORIA,
  type EntidadReferenciaAuditoria,
} from '../config/auditoria-tablas.config';
import {
  crearNombresResueltosVacios,
  humanizarAuditoria,
  type NombresResueltosAuditoria,
} from './formatear-valor-auditoria.helper';

/** Modelos de Prisma que se consultan para traducir IDs a nombres. */
export type ClienteNombresAuditoria = Pick<
  PrismaService,
  | 'empleados'
  | 'area'
  | 'cargo'
  | 'jornada'
  | 'bancos'
  | 'tipo_afp'
  | 'regimen_pension'
  | 'tipo_documento'
  | 'derechohabientes'
  | 'usuarios'
>;

/** IDs que se necesita traducir, agrupados por entidad. */
export type IdsPorEntidadAuditoria = Record<
  EntidadReferenciaAuditoria,
  Set<string>
>;

/**
 * Crea el contenedor vacío de IDs pendientes de traducir.
 *
 * @returns Un conjunto vacío por cada entidad referenciable.
 */
export function crearIdsPorEntidadVacios(): IdsPorEntidadAuditoria {
  return {
    empleado: new Set(),
    area: new Set(),
    cargo: new Set(),
    jornada: new Set(),
    banco: new Set(),
    afp: new Set(),
    regimen: new Set(),
    tipo_documento: new Set(),
    derechohabiente: new Set(),
    usuario: new Set(),
  };
}

/** Vínculo familiar legible en minúscula, por ejemplo `hijo menor`. */
function etiquetaVinculo(vinculo: string): string {
  const opciones = TABLAS_AUDITORIA.derechohabientes.campos.vinculo.opciones;
  return (opciones?.[vinculo] ?? humanizarAuditoria(vinculo)).toLowerCase();
}

function nombreCompleto(
  nombre?: string | null,
  apellido?: string | null
): string {
  return `${nombre ?? ''} ${apellido ?? ''}`.trim();
}

/**
 * Traduce los IDs de una página de auditoría a nombres con una sola consulta por entidad
 * (nunca una por fila). Las entidades sin IDs pendientes no generan consulta.
 *
 * @param prisma - Cliente con los modelos de catálogo.
 * @param ids - IDs pendientes agrupados por entidad.
 * @returns Los nombres encontrados; un ID que ya no existe simplemente no aparece.
 */
export async function resolverNombresAuditoria(
  prisma: ClienteNombresAuditoria,
  ids: IdsPorEntidadAuditoria
): Promise<NombresResueltosAuditoria> {
  const nombres = crearNombresResueltosVacios();
  const enLista = (entidad: EntidadReferenciaAuditoria) => ({
    in: [...ids[entidad]],
  });
  const pendiente = (entidad: EntidadReferenciaAuditoria) =>
    ids[entidad].size > 0;

  await Promise.all([
    pendiente('empleado') &&
      prisma.empleados
        .findMany({
          where: { id: enLista('empleado') },
          select: {
            id: true,
            nombre: true,
            apellido: true,
            nro_documento: true,
          },
        })
        .then((filas) => {
          for (const f of filas) {
            nombres.empleado.set(f.id, {
              nombre: nombreCompleto(f.nombre, f.apellido),
              detalle: f.nro_documento,
            });
          }
        }),
    pendiente('area') &&
      prisma.area
        .findMany({
          where: { id: enLista('area') },
          select: { id: true, nombre: true },
        })
        .then((filas) => {
          for (const f of filas)
            nombres.area.set(f.id, { nombre: f.nombre, detalle: null });
        }),
    pendiente('cargo') &&
      prisma.cargo
        .findMany({
          where: { id: enLista('cargo') },
          select: {
            id: true,
            nombre: true,
            area: { select: { nombre: true } },
          },
        })
        .then((filas) => {
          for (const f of filas) {
            nombres.cargo.set(f.id, {
              nombre: f.nombre,
              detalle: f.area?.nombre ?? null,
            });
          }
        }),
    pendiente('jornada') &&
      prisma.jornada
        .findMany({
          where: { id: enLista('jornada') },
          select: { id: true, nombre: true },
        })
        .then((filas) => {
          for (const f of filas)
            nombres.jornada.set(f.id, { nombre: f.nombre, detalle: null });
        }),
    pendiente('banco') &&
      prisma.bancos
        .findMany({
          where: { id: enLista('banco') },
          select: { id: true, nombre: true },
        })
        .then((filas) => {
          for (const f of filas)
            nombres.banco.set(f.id, { nombre: f.nombre, detalle: null });
        }),
    pendiente('afp') &&
      prisma.tipo_afp
        .findMany({
          where: { id: enLista('afp') },
          select: { id: true, nombre: true },
        })
        .then((filas) => {
          for (const f of filas)
            nombres.afp.set(f.id, { nombre: f.nombre, detalle: null });
        }),
    pendiente('regimen') &&
      prisma.regimen_pension
        .findMany({
          where: { id: enLista('regimen') },
          select: { id: true, nombre: true },
        })
        .then((filas) => {
          for (const f of filas)
            nombres.regimen.set(f.id, { nombre: f.nombre, detalle: null });
        }),
    pendiente('tipo_documento') &&
      prisma.tipo_documento
        .findMany({
          where: { id: enLista('tipo_documento') },
          select: { id: true, tipo_documento: true },
        })
        .then((filas) => {
          for (const f of filas) {
            nombres.tipo_documento.set(f.id, {
              nombre: f.tipo_documento,
              detalle: null,
            });
          }
        }),
    pendiente('derechohabiente') &&
      prisma.derechohabientes
        .findMany({
          where: { id: enLista('derechohabiente') },
          select: { id: true, nombres: true, apellidos: true, vinculo: true },
        })
        .then((filas) => {
          for (const f of filas) {
            nombres.derechohabiente.set(f.id, {
              nombre: nombreCompleto(f.nombres, f.apellidos),
              detalle: etiquetaVinculo(f.vinculo),
            });
          }
        }),
    pendiente('usuario') &&
      prisma.usuarios
        .findMany({
          where: { id: enLista('usuario') },
          select: {
            id: true,
            email: true,
            empleados: { select: { nombre: true, apellido: true } },
          },
        })
        .then((filas) => {
          for (const f of filas) {
            nombres.usuario.set(f.id, {
              nombre:
                nombreCompleto(f.empleados?.nombre, f.empleados?.apellido) ||
                f.email,
              detalle: null,
            });
          }
        }),
  ]);

  return nombres;
}
