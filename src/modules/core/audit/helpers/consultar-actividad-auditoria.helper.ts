//src/modules/core/audit/helpers/consultar-actividad-auditoria.helper.ts
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '@/common/prisma/prisma.service';
import type { ListaActividadAuditoria } from '@jyp/shared-contracts';
import {
  INCLUIR_ACTOR_AUDITORIA,
  presentarActividad,
} from './presentar-actividad.helper';

/**
 * Lee una página de `audit_log` con su actor y la presenta para RRHH. El total y la página se
 * leen en la misma transacción para que la paginación sea coherente.
 *
 * @param prisma - Cliente de Prisma.
 * @param where - Filtro ya restringido por rol (`construirFiltroBase`).
 * @param page - Número de página, desde 1.
 * @param limit - Filas por página.
 * @returns Las filas de actividad y los metadatos de paginación.
 */
export async function consultarActividadAuditoria(
  prisma: PrismaService,
  where: Prisma.audit_logWhereInput,
  page: number,
  limit: number
): Promise<ListaActividadAuditoria> {
  const [total, filas] = await prisma.$transaction([
    prisma.audit_log.count({ where }),
    prisma.audit_log.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      include: INCLUIR_ACTOR_AUDITORIA,
    }),
  ]);

  return {
    data: await presentarActividad(prisma, filas),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
