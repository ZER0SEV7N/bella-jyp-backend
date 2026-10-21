import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { EntradaPlanilla } from '../domain/planilla.types';

const CODIGOS = ['RMV', 'UIT', 'ESSALUD_PCT', 'ONP_PCT', 'VIDA_LEY_PCT'] as const; //Los códigos de parámetros legales que deben tener una sola vigencia para un periodo determinado.

/**
 * Funcion Asincronica para cargar los parámetros legales de la planilla de un periodo determinado.
 * Verifica que exista una sola vigencia de cada parámetro legal para el periodo.
 * @param tx - Cliente de transacción de Prisma.
 * @param referencia - Fecha de referencia para determinar la vigencia de los parámetros legales.
 * @param periodo - Periodo en formato 'YYYY-MM' para el cual se están cargando los parámetros legales.
 * @returns - Un objeto que contiene los parámetros legales y sus valores correspondientes para el periodo.
 */
export async function cargarParametrosPlanilla(tx: Prisma.TransactionClient, referencia: Date, periodo: string) {
    const parametros = await tx.parametro_legal.findMany({
        where: { codigo: { in: [...CODIGOS] }, 
            vigente_desde: { lte: referencia }, OR: [{ vigente_hasta: null }, { vigente_hasta: { gte: referencia } }] },
        orderBy: [{ codigo: 'asc' }, { vigente_desde: 'asc' }]
    });

    //Verificar que exista una sola vigencia de cada parámetro legal para el periodo
    for (const codigo of CODIGOS)
        if (parametros.filter((p) => p.codigo === codigo).length !== 1)
            throw new ConflictException(`Debe existir una sola vigencia de ${codigo} para ${periodo}.`);
    const valores = Object.fromEntries(parametros.map((p) => [p.codigo, p.valor.toString()])) as EntradaPlanilla['parametros'];

    return { parametros, valores };
}
