//src/modules/core/audit/use-cases/listarLineaTiempoAfectado.useCase.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type {
  AfectadoParamsDto,
  LineaTiempoAfectadoQueryDto,
  ListaActividadAuditoria,
} from '@jyp/shared-contracts';
import { consultarActividadAuditoria } from '../helpers/consultar-actividad-auditoria.helper';
import {
  construirFiltroBase,
  type UsuarioSolicitanteAuditoria,
} from '../helpers/construir-filtro-base-auditoria.helper';

/** Línea de tiempo de cambios de un empleado, área, cargo o jornada (AUD-M2). */
@Injectable()
export class ListarLineaTiempoAfectadoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve la actividad de un afectado, de la más reciente a la más antigua, con el mismo
   * formato de fila que `/actividad`. Reúne los cambios de todas las tablas relacionadas
   * (por ejemplo, de un empleado: contratos, familiares, datos financieros y asistencia).
   *
   * @param params - Tipo e ID del afectado.
   * @param query - Paginación y rango de fechas.
   * @param usuario - Usuario autenticado; su rol limita las tablas visibles.
   * @returns La página de actividad y sus metadatos.
   * @throws {ForbiddenException} Si el rol no puede consultar la auditoría.
   */
  async execute(
    params: AfectadoParamsDto,
    query: LineaTiempoAfectadoQueryDto,
    usuario: UsuarioSolicitanteAuditoria
  ): Promise<ListaActividadAuditoria> {
    const { page, limit, desde, hasta } = query;
    const where = construirFiltroBase(
      usuario,
      {
        afectado_tipo: params.tipo,
        afectado_id: params.id,
        desde,
        hasta,
      },
      { diasEnHoraLima: true }
    );
    return consultarActividadAuditoria(this.prisma, where, page, limit);
  }
}
