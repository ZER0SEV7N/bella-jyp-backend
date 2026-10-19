import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { cargarFuentesPlanilla } from './fuentes-planilla.helper';

/** Resuelve el régimen y su comisión usando la fecha del período solicitado. */
export async function cargarPensionPlanilla(tx: Prisma.TransactionClient, financiero: Awaited<ReturnType<typeof cargarFuentesPlanilla>>['financiero'], referencia: Date) {
    const pension = financiero.regimen_pension.nombre.trim().toUpperCase();
    const esOnp = pension === 'ONP';
    if (!esOnp && !['AFP', 'SPP', 'SPP / AFP'].includes(pension)) throw new BadRequestException('El régimen previsional no está soportado.');
    const comisiones = esOnp
        ? []
        : await tx.comisiones_afp.findMany({
              where: {
                  afp_id: financiero.id_tipo_afp,
                  periodo_inicio: { lte: referencia },
                  OR: [{ periodo_final: null }, { periodo_final: { gte: referencia } }]
              },
              orderBy: { id: 'asc' }
          });
    if (!esOnp && (!financiero.id_tipo_afp || comisiones.length !== 1))
        throw new ConflictException('Se requiere una sola comisión AFP vigente para el período.');

    return { pension, esOnp, comisiones };
}
