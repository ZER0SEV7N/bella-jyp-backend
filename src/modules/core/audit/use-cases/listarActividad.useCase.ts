//src/modules/core/audit/use-cases/listarActividad.useCase.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type {
  ActividadAuditoriaQueryDto,
  ListaActividadAuditoria,
} from '../contracts/actividad-auditoria.schema';
import { consultarActividadAuditoria } from '../helpers/consultar-actividad-auditoria.helper';
import {
  construirFiltroBase,
  type UsuarioSolicitanteAuditoria,
} from '../helpers/construir-filtro-base-auditoria.helper';

/** Lista la actividad auditada en lenguaje de negocio (AUD-M2). */
@Injectable()
export class ListarActividadUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve una página de actividad con los mismos filtros y permisos que `/logs`, más el
   * filtro por afectado. Cada fila trae actor, afectado, resumen y campos modificados.
   *
   * @param query - Filtros y paginación ya validados.
   * @param usuario - Usuario autenticado; su rol limita las tablas visibles.
   * @returns La página de actividad y sus metadatos.
   * @throws {ForbiddenException} Si el rol no puede consultar la auditoría o la tabla pedida.
   */
  async execute(
    query: ActividadAuditoriaQueryDto,
    usuario: UsuarioSolicitanteAuditoria
  ): Promise<ListaActividadAuditoria> {
    const { page, limit, ...filtros } = query;
    const where = construirFiltroBase(usuario, filtros, {
      diasEnHoraLima: true,
    });
    return consultarActividadAuditoria(this.prisma, where, page, limit);
  }
}
