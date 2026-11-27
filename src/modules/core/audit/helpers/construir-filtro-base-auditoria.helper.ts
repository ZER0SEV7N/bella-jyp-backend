// src/modules/core/audit/helpers/construir-filtro-base-auditoria.helper.ts
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TABLAS_PERMITIDAS_RRHH } from '../config/auditoria-tablas.config';

/**
 * Helper que construye un filtro base para consultar los registros de auditoría (`audit_log`) según los parámetros proporcionados y el rol del usuario solicitante.
 * Este helper permite aplicar restricciones de visibilidad según el rol del usuario, asegurando que solo pueda acceder a los registros que le corresponden.
 */
export interface UsuarioSolicitanteAuditoria {
  id: string;
  rol: string;
}

/**
 * Filtros de auditoría que pueden ser aplicados para consultar los registros de auditoría.
 * Estos filtros incluyen la tabla afectada, la acción realizada, el usuario que realizó la acción, el registro afectado, el tipo y ID del afectado, así como un rango de fechas.
 */
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

/**
 * Construye un rango de fechas para filtrar los registros de auditoría según los filtros proporcionados.
 * 
 * @param filtros - Filtros de auditoría que pueden incluir `desde` y `hasta` para definir el rango de fechas.
 * @param opciones - Opciones de interpretación de los filtros, como si se deben considerar los días en hora de Lima.
 * @returns - Un objeto de filtro de Prisma que representa el rango de fechas para la consulta de auditoría.
 */
function construirRangoFechas(
  filtros: FiltrosAuditoria,
  opciones: OpcionesFiltroAuditoria
): Prisma.audit_logWhereInput {
  // Si no se especifican los filtros de fecha `desde` y `hasta`, se devuelve un objeto vacío, lo que significa que no se aplicará ningún filtro de rango de fechas.
  if (!filtros.desde && !filtros.hasta) return {};

  // Si se especifica la opción `diasEnHoraLima`, se ajusta el rango de fechas para que considere los días en la zona horaria de Lima (UTC-5). 
  // Se calcula el inicio del día y el final del día siguiente para establecer el rango.
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

  // Si no se especifica la opción `diasEnHoraLima`, se construye el rango de fechas en UTC, considerando el inicio del día y el final del día siguiente.
  return {
    created_at: {
      ...(filtros.desde && { gte: new Date(filtros.desde) }),
      ...(filtros.hasta && {
        lte: new Date(`${filtros.hasta.slice(0, 10)}T23:59:59.999Z`),
      }),
    },
  };
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

/**
 * Aplica restricciones de visibilidad para el rol de RRHH, limitando las tablas que puede auditar.
 * @param where - Filtro base de `audit_log`.
 * @param tablaAfectada - Tabla afectada, si se especifica.
 * @returns El filtro de Prisma con las restricciones aplicadas.
 * @throws {ForbiddenException} Si el rol no puede auditar la tabla pedida.
 */
function aplicarRestriccionRrhh(
  where: Prisma.audit_logWhereInput,
  tablaAfectada?: string
): Prisma.audit_logWhereInput {
  // Se verifica si la tabla afectada está permitida para el rol de RRHH. Si no lo está, se lanza una excepción ForbiddenException.
  if (
    tablaAfectada &&
    !(TABLAS_PERMITIDAS_RRHH as readonly string[]).includes(tablaAfectada)
  )
    throw new ForbiddenException(
      'Su rol no tiene permiso para auditar la tabla solicitada.'
    );

  // Se construye el filtro final, agregando la restricción de tablas permitidas si no se especifica una tabla afectada.
  return tablaAfectada
    ? where
    : { ...where, tabla_afectada: { in: [...TABLAS_PERMITIDAS_RRHH] } };
}

/**
 * Construye el filtro de `audit_log` según los parámetros y el rol de quien consulta.
 * 
 * @param where - Filtro base de `audit_log`.
 * @param usuario - Usuario autenticado; su rol limita las tablas visibles.
 * @param tablaAfectada - Tabla afectada, si se especifica.
 * @returns El filtro de Prisma con las restricciones aplicadas.
 */
function aplicarRestriccionRol(
  where: Prisma.audit_logWhereInput,
  usuario: UsuarioSolicitanteAuditoria,
  tablaAfectada?: string
): Prisma.audit_logWhereInput {

  // Se aplican restricciones según el rol del usuario. Los administradores pueden ver todo, RRHH tiene acceso limitado a ciertas tablas, y los contadores solo pueden ver sus propias acciones y las de asistentes.
  if (usuario.rol === 'ADMIN') return where;

  // Se aplican restricciones según el rol del usuario. Los administradores pueden ver todo, RRHH tiene acceso limitado a ciertas tablas, y los contadores solo pueden ver sus propias acciones y las de asistentes.
  if (usuario.rol === 'RRHH')
    return aplicarRestriccionRrhh(where, tablaAfectada);

  // Se aplican restricciones según el rol del usuario. Los administradores pueden ver todo, RRHH tiene acceso limitado a ciertas tablas, y los contadores solo pueden ver sus propias acciones y las de asistentes.
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
