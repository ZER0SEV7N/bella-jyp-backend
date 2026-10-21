import { IdentityGenerator } from '../../src/common/utils/uuid.util';
import { ClienteSeed, comprobarValor } from './vigencias.helper';

/** Valores con vigencia explícita. Las tasas son fracciones: 0.09 representa 9 %. */
export async function seedParametrosLegales(prisma: ClienteSeed) {
    const parametros = [
        { codigo: 'RMV', nombre: 'Remuneración Mínima Vital', valor: '1130', desde: '2025-01-01', hasta: '2026-09-30', fuente: 'D.S. 006-2024-TR' },
        { codigo: 'RMV', nombre: 'Remuneración Mínima Vital', valor: '1230', desde: '2026-10-01', hasta: null, fuente: 'D.S. 015-2026-TR, primer tramo. Segundo tramo aún no vigente.' },
        { codigo: 'UIT', nombre: 'Unidad Impositiva Tributaria', valor: '5500', desde: '2026-01-01', hasta: '2026-12-31', fuente: 'D.S. 301-2025-EF' },
        { codigo: 'ESSALUD_PCT', nombre: 'Aporte EsSalud empleador', valor: '0.09', desde: '2026-01-01', hasta: '2026-12-31', fuente: 'Ley 26790. Cobertura inicial del seeder: ejercicio 2026.' },
        { codigo: 'ONP_PCT', nombre: 'Retención SNP', valor: '0.13', desde: '2026-01-01', hasta: '2026-12-31', fuente: 'SNP: 13 %. Cobertura inicial del seeder: ejercicio 2026.' },
    ];
    
    //Vida Ley depende de la póliza. No se inventa una tarifa legal universal.
    const vida = process.env.SEED_VIDA_LEY_PCT;
    if (vida !== undefined) {
        if (!/^0\.\d{1,4}$/.test(vida) || Number(vida) <= 0 || Number(vida) >= 1) {
            throw new Error('SEED_VIDA_LEY_PCT debe ser una fracción positiva de hasta cuatro decimales según la póliza.');
        }
        parametros.push({ codigo: 'VIDA_LEY_PCT', nombre: 'Prima Vida Ley contratada', valor: vida, desde: process.env.SEED_VIDA_LEY_DESDE ?? '2026-01-01', hasta: process.env.SEED_VIDA_LEY_HASTA ?? '2026-12-31', fuente: 'Configuración expresa de la empresa: verificar vigencia de la póliza.' });
    }
    for (const parametro of parametros) {
        const desde = new Date(parametro.desde);
        const hasta = parametro.hasta ? new Date(parametro.hasta) : null;
        const anteriores = await prisma.parametro_legal.findMany({
            where: { codigo: parametro.codigo, vigente_desde: { lte: hasta ?? new Date('9999-12-31') }, OR: [{ vigente_hasta: null }, { vigente_hasta: { gte: desde } }] },
        });
        const actual = anteriores.find((registro) => registro.vigente_desde.getTime() === desde.getTime());
        if (anteriores.some((registro) => registro.id !== actual?.id)) {
            throw new Error(`${parametro.codigo}: hay vigencias superpuestas. Revise los datos anteriores antes de sembrar.`);
        }
        if (actual) {
            comprobarValor(actual.valor, parametro.valor, parametro.codigo);
            if (actual.vigente_hasta?.getTime() !== hasta?.getTime()) {
                throw new Error(`${parametro.codigo}: la fecha final existente difiere del catálogo verificado.`);
            }
            continue;
        }
        await prisma.parametro_legal.create({ data: { id: IdentityGenerator.generateId(), codigo: parametro.codigo, nombre: parametro.nombre, valor: parametro.valor, vigente_desde: desde, vigente_hasta: hasta, descripcion: parametro.fuente } });
    }
    if (vida === undefined) {
        console.warn('Vida Ley pendiente: registre tasa y vigencia de la póliza. La planilla exigirá esta configuración.');
    }
}
