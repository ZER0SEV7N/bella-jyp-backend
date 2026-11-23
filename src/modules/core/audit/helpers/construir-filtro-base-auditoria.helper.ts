// src/modules/core/audit/helpers/construir-filtro-base-auditoria.helper.ts
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TABLAS_PERMITIDAS_RRHH } from '../config/auditoria-tablas.config';

export interface UsuarioSolicitanteAuditoria {
  id: string;
  rol: string;
}

export interface FiltrosAuditoria {
  tabla_afectada?: string;
  accion?: string;
  usuario_id?: string;
  registro_id?: string;
  afectado_tipo?: string;
  afectado_id?: string;
  desde?: string;
  hasta?: string;
}

/** Opciones de interpretación de los filtros. */
export interface OpcionesFiltroAuditoria {
  /**
   * Interpreta `desde` y `hasta` como días de Lima (UTC-5 fijo): de las 05:00Z del día `desde`
   * hasta las 05:00Z del día siguiente a `hasta`, exclusive. Sin esta opción se mantienen los
   * límites en UTC que usa `/logs`.
   */
  diasEnHoraLima?: boolean;
}

const DESFASE_LIMA_HORAS = 5;

function construirRangoFechas(
  filtros: FiltrosAuditoria,
  opciones: OpcionesFiltroAuditoria
): Prisma.audit_logWhereInput {
  if (!filtros.desde && !filtros.hasta) return {};

  if (opciones.diasEnHoraLima) {
    const inicioDia = (fecha: string, sumarDias: number) => {
      const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number);
      return new Date(
        Date.UTC(anio, mes - 1, dia + sumarDias, DESFASE_LIMA_HORAS)
      );
    };
    return {
      created_at: {
        ...(filtros.desde && { gte: inicioDia(filtros.desde, 0) }),
        ...(filtros.hasta && { lt: inicioDia(filtros.hasta, 1) }),
      },
    };
  }

  return {
    created_at: {
      ...(filtros.desde && { gte: new Date(filtros.desde) }),
      ...(filtros.hasta && {
        lte: new Date(`${filtros.hasta.slice(0, 10)}T23:59:59.999Z`),
      }),
    },
  };
}

function construirFiltrosConsulta(
  filtros: FiltrosAuditoria,
  opciones: OpcionesFiltroAuditoria
): Prisma.audit_logWhereInput {
  return {
    ...(filtros.tabla_afectada && { tabla_afectada: filtros.tabla_afectada }),
    ...(filtros.accion && { accion: filtros.accion }),
    ...(filtros.usuario_id && { usuario_id: filtros.usuario_id }),
    ...(filtros.registro_id && { registro_id: filtros.registro_id }),
    ...(filtros.afectado_tipo && { afectado_tipo: filtros.afectado_tipo }),
    ...(filtros.afectado_id && { afectado_id: filtros.afectado_id }),
    ...construirRangoFechas(filtros, opciones),
  };
}

function aplicarRestriccionRrhh(
  where: Prisma.audit_logWhereInput,
  tablaAfectada?: string
): Prisma.audit_logWhereInput {
  if (
    tablaAfectada &&
    !(TABLAS_PERMITIDAS_RRHH as readonly string[]).includes(tablaAfectada)
  )
    throw new ForbiddenException(
      'Su rol no tiene permiso para auditar la tabla solicitada.'
    );

  return tablaAfectada
    ? where
    : { ...where, tabla_afectada: { in: [...TABLAS_PERMITIDAS_RRHH] } };
}

function aplicarRestriccionRol(
  where: Prisma.audit_logWhereInput,
  usuario: UsuarioSolicitanteAuditoria,
  tablaAfectada?: string
): Prisma.audit_logWhereInput {
  if (usuario.rol === 'ADMIN') return where;
  if (usuario.rol === 'RRHH')
    return aplicarRestriccionRrhh(where, tablaAfectada);
  if (usuario.rol === 'CONTADOR') {
    return {
      ...where,
      usuarios: { OR: [{ id: usuario.id }, { rol: 'ASISTENTE' }] },
    };
  }

  throw new ForbiddenException(
    'No tiene los privilegios para auditar el sistema.'
  );
}

/**
 * Construye el filtro de `audit_log` según los parámetros y el rol de quien consulta.
 *
 * @param usuario - Usuario autenticado; su rol limita las tablas visibles.
 * @param filtros - Filtros pedidos.
 * @param opciones - Cómo interpretar las fechas.
 * @returns El filtro de Prisma.
 * @throws {ForbiddenException} Si el rol no puede auditar o la tabla pedida.
 */
export function construirFiltroBase(
  usuario: UsuarioSolicitanteAuditoria,
  filtros: FiltrosAuditoria,
  opciones: OpcionesFiltroAuditoria = {}
): Prisma.audit_logWhereInput {
  const where = construirFiltrosConsulta(filtros, opciones);
  return aplicarRestriccionRol(where, usuario, filtros.tabla_afectada);
}
