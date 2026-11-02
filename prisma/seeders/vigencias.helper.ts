// prisma/seeders/vigencias.helper.ts
import { Prisma } from '@prisma/client';

/**
 * Comprueba si el valor actual coincide con el valor esperado.
 * Si no coinciden, lanza un error indicando que existe un valor diferente.
 * Esta función se utiliza para asegurar que los valores de los parámetros legales y comisiones no se modifiquen inadvertidamente.
 * @param actual - El valor actual que se encuentra en la base de datos.
 * @param esperado - El valor que se espera según la configuración del seeder.
 * @param nombre - El nombre del parámetro o comisión a verificar.
 */
export function comprobarValor(actual: Prisma.Decimal, esperado: string, nombre: string): void {
    if (!actual.eq(esperado)) 
        throw new Error(`${nombre}: existe un valor diferente. Revise la configuración; el seeder no modifica históricos.`);
    
}
export type ClienteSeed = Prisma.TransactionClient;
