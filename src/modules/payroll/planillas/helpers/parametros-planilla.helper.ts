import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { EntradaPlanilla } from '../domain/planilla.types';

const CODIGOS = ['RMV', 'UIT', 'ESSALUD_PCT', 'ONP_PCT', 'VIDA_LEY_PCT'] as const;

/** Una vigencia ambigua se rechaza antes de enviar importes al motor. */
export async function cargarParametrosPlanilla(tx: Prisma.TransactionClient, referencia: Date, periodo: string) {
    const parametros = await tx.parametro_legal.findMany({
        where: { codigo: { in: [...CODIGOS] }, vigente_desde: { lte: referencia }, OR: [{ vigente_hasta: null }, { vigente_hasta: { gte: referencia } }] },
        orderBy: [{ codigo: 'asc' }, { vigente_desde: 'asc' }]
    });
    for (const codigo of CODIGOS)
        if (parametros.filter((p) => p.codigo === codigo).length !== 1)
            throw new ConflictException(`Debe existir una sola vigencia de ${codigo} para ${periodo}.`);
    const valores = Object.fromEntries(parametros.map((p) => [p.codigo, p.valor.toString()])) as EntradaPlanilla['parametros'];

    return { parametros, valores };
}
