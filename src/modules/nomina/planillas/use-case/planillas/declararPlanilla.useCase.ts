//src/modules/nomina/planillas/use-case/planillas/declararPlanilla.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { transaccionAuditada } from '@/common/utils/transaccion-auditada.util';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';
import type { DeclararPlanillaDto } from '../../schemas/declarar-planilla.schema';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

/**
 * Caso de uso para declarar una planilla congelada (PLA-F3).
 * La declaración es terminal: pasa CONGELADO → DECLARADO y no admite reapertura (D4).
 */
@Injectable()
export class DeclararPlanillaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string, dto: DeclararPlanillaDto, actor: ActorOperacion) {
    return transaccionAuditada(this.prisma, actor, async (tx) => {
      const planilla = await tx.historial_planillas.findUnique({ where: { id } });

      if (!planilla) throw new NotFoundException('La planilla no existe.');

      //La declaración solo procede desde CONGELADO; DECLARADO es terminal y no se reabre (D4).
      if (planilla.estado !== 'CONGELADO')
        throw new ConflictException('Solo se puede declarar una planilla congelada.');

      //La versión optimista evita declarar sobre una planilla que cambió desde su consulta.
      if (planilla.version !== dto.version)
        throw new ConflictException('La planilla cambió desde que fue consultada.');

      //El motivo del congelamiento se conserva; el de la declaración se agrega al historial.
      const motivoDeclaracion = dto.motivo?.trim();
      const comentarios = motivoDeclaracion
        ? [planilla.comentarios, `Declaración: ${motivoDeclaracion}`]
            .filter(Boolean)
            .join('\n')
        : planilla.comentarios;

      return tx.historial_planillas.update({
        where: { id, version: dto.version, estado: 'CONGELADO' },
        data: {
          estado: 'DECLARADO',
          declarado_por: actor.id,
          declarado_en: new Date(),
          comentarios,
          version: { increment: 1 },
        },
      });
    });
  }
}
