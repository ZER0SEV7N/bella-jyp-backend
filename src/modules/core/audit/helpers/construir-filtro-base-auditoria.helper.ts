// src/modules/core/audit/helpers/construir-filtro-base-auditoria.helper.ts
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TABLAS_PERMITIDAS_RRHH } from './calcular-cambios-auditoria.helper';

export interface UsuarioSolicitanteAuditoria {
  id: string;
  rol: string;
}

export interface FiltrosAuditoria {
  tabla_afectada?: string;
  accion?: string;
  usuario_id?: string;
  registro_id?: string;
  desde?: string;
  hasta?: string;
}

function construirFiltrosConsulta(filtros: FiltrosAuditoria): Prisma.audit_logWhereInput {
  return {
    ...(filtros.tabla_afectada && { tabla_afectada: filtros.tabla_afectada }),
    ...(filtros.accion && { accion: filtros.accion }),
    ...(filtros.usuario_id && { usuario_id: filtros.usuario_id }),
    ...(filtros.registro_id && { registro_id: filtros.registro_id }),
    ...(filtros.desde || filtros.hasta
      ? {
          created_at: {
            ...(filtros.desde && { gte: new Date(filtros.desde) }),
            ...(filtros.hasta && {
              lte: new Date(`${filtros.hasta.slice(0, 10)}T23:59:59.999Z`),
            }),
          },
        }
      : {}),
  };
}

function aplicarRestriccionRrhh(where: Prisma.audit_logWhereInput, tablaAfectada?: string): Prisma.audit_logWhereInput {
  if (tablaAfectada && !(TABLAS_PERMITIDAS_RRHH as readonly string[]).includes(tablaAfectada)) 
    throw new ForbiddenException('Su rol no tiene permiso para auditar la tabla solicitada.');
  

  return tablaAfectada ? where : { ...where, tabla_afectada: { in: [...TABLAS_PERMITIDAS_RRHH] } };
}

function aplicarRestriccionRol( where: Prisma.audit_logWhereInput, usuario: UsuarioSolicitanteAuditoria, tablaAfectada?: string ): Prisma.audit_logWhereInput {
  if (usuario.rol === 'ADMIN') return where;
  if (usuario.rol === 'RRHH') return aplicarRestriccionRrhh(where, tablaAfectada);
  if (usuario.rol === 'CONTADOR') {
    return {
      ...where,
      usuarios: { OR: [{ id: usuario.id }, { rol: 'ASISTENTE' }] },
    };
  }

  throw new ForbiddenException('No tiene los privilegios para auditar el sistema.');
}

export function construirFiltroBase( usuario: UsuarioSolicitanteAuditoria, filtros: FiltrosAuditoria ): Prisma.audit_logWhereInput {
  const where = construirFiltrosConsulta(filtros);
  return aplicarRestriccionRol(where, usuario, filtros.tabla_afectada);
}
