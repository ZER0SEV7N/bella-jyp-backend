//src/modules/core/audit/use-cases/obtenerActividadPorId.useCase.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { DetalleActividadAuditoria } from '@jyp/shared-contracts';
import {
  construirFiltroBase,
  type UsuarioSolicitanteAuditoria,
} from '../helpers/construir-filtro-base-auditoria.helper';
import {
  INCLUIR_ACTOR_AUDITORIA,
  presentarDetalleActividad,
} from '../helpers/presentar-actividad.helper';

/** Obtiene el detalle de una fila de actividad con sus cambios legibles (AUD-M2). */
@Injectable()
export class ObtenerActividadPorIdUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve la fila de actividad con la lista de cambios: IDs reemplazados por nombres, enums
   * con etiqueta, fechas normalizadas y listas comparadas por elemento.
   *
   * @param id - ID del registro de auditoría.
   * @param usuario - Usuario autenticado; su rol limita las tablas visibles.
   * @returns El detalle de la actividad.
   * @throws {NotFoundException} Si no existe o el rol no puede ver su tabla.
   * @throws {ForbiddenException} Si el rol no puede consultar la auditoría.
   */
  async execute(
    id: string,
    usuario: UsuarioSolicitanteAuditoria
  ): Promise<DetalleActividadAuditoria> {
    const registro = await this.prisma.audit_log.findFirst({
      where: { ...construirFiltroBase(usuario, {}), id },
      include: INCLUIR_ACTOR_AUDITORIA,
    });
    if (!registro) {
      throw new NotFoundException({
        title: 'Registro de auditoría no encontrado',
        detail: 'No existe un registro de auditoría con ese identificador.',
      });
    }
    return presentarDetalleActividad(this.prisma, registro);
  }
}
