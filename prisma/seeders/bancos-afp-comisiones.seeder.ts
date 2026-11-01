//prisma/seeders/bancos-afp-comisiones.seeder.ts
import { IdentityGenerator } from '../../src/common/utils/uuid.util';
import { ClienteSeed } from './vigencias.helper';

/**
 * Seede para el llenado de la tabla de bancos, tipo de documento, regimen de pensiones y tipo de AFP.
 * En este seeder se insertan los siguientes datos:
 *   - Bancos: BANCO DE CREDITO DEL PERU (BCP), 
 *             BBVA PERU, 
 *             INTERBANK, 
 *             SCOTIABANK PERU, 
 *             BANBIF, 
 *             BANCO PICHINCHA, 
 *             BANCO DE LA NACION
 *   - Tipo de documento: DNI, CE, PASAPORTE
 *   - Regimen de pensiones: ONP, SPP
 *   - Tipo de AFP: INTEGRA, PRIMA, PROFUTURO, HABITAT
 * 
 */

export async function seedBancosAfpComisiones(prisma: ClienteSeed) {
    // Seed de bancos
    for (const nombre of ['BANCO DE CREDITO DEL PERU (BCP)', 'BBVA PERU', 'INTERBANK', 'SCOTIABANK PERU', 'BANBIF', 'BANCO PICHINCHA', 'BANCO DE LA NACION']) {
        const banco = await prisma.bancos.findFirst({ where: { nombre } });
        if (!banco) 
            await prisma.bancos.create({ data: { id: IdentityGenerator.generateId(), nombre } });
        
    }

    // Seed de tipo de documento
    for (const tipo_documento of ['DNI', 'CE', 'PASAPORTE']) {
        await prisma.tipo_documento.upsert({ where: { tipo_documento }, update: {}, create: { id: IdentityGenerator.generateId(), tipo_documento } });
    }

    // Seed de regimen de pensiones y tipo de AFP
    for (const nombre of ['ONP', 'SPP']) {
        const regimen = await prisma.regimen_pension.findFirst({ where: { nombre } });
        if (!regimen) 
            await prisma.regimen_pension.create({ data: { id: IdentityGenerator.generateId(), nombre } });
        
    }

    // Seed de tipo de AFP
    const spp = await prisma.regimen_pension.findFirstOrThrow({ where: { nombre: 'SPP' } });
    for (const nombre of ['INTEGRA', 'PRIMA', 'PROFUTURO', 'HABITAT']) {
        const afp = await prisma.tipo_afp.findFirst({ where: { nombre, id_regimen: spp.id } });
        if (!afp) {
            await prisma.tipo_afp.create({ data: { id: IdentityGenerator.generateId(), nombre, id_regimen: spp.id } });
        }
    }
}
