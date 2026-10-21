import { Prisma } from '@prisma/client';

/** El seeder completa catálogos, pero nunca reemplaza decisiones financieras previas. */
export function comprobarValor(actual: Prisma.Decimal, esperado: string, nombre: string): void {
    if (!actual.eq(esperado)) {
        throw new Error(`${nombre}: existe un valor diferente. Revise la configuración; el seeder no modifica históricos.`);
    }
}
export type ClienteSeed = Prisma.TransactionClient;
