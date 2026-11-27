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
    const nombresBancos = ['BANCO DE CREDITO DEL PERU (BCP)', 'BBVA PERU', 'INTERBANK', 'SCOTIABANK PERU', 'BANBIF', 'BANCO PICHINCHA', 'BANCO DE LA NACION'];
    const bancosExistentes = await prisma.bancos.findMany({ where: { nombre: { in: nombresBancos } }, select: { nombre: true } });
    const nombresExistentes = new Set(bancosExistentes.map(({ nombre }) => nombre));
    const bancosNuevos = nombresBancos
        .filter((nombre) => !nombresExistentes.has(nombre))
        .map((nombre) => ({ id: IdentityGenerator.generateId(), nombre }));
    if (bancosNuevos.length > 0) {
        await prisma.bancos.createMany({ data: bancosNuevos });
    }

    // Seed de tipo de documento
    await Promise.all(['DNI', 'CE', 'PASAPORTE'].map((tipo_documento) =>
        prisma.tipo_documento.upsert({ where: { tipo_documento }, update: {}, create: { id: IdentityGenerator.generateId(), tipo_documento } }),
    ));

    // Seed de regimen de pensiones y tipo de AFP
    const nombresRegimen = ['ONP', 'SPP'];
    const regimenesExistentes = await prisma.regimen_pension.findMany({
        where: { nombre: { in: nombresRegimen } },
        select: { nombre: true },
    });
    const nombresRegimenExistentes = new Set(regimenesExistentes.map(({ nombre }) => nombre));
    const regimenesNuevos = nombresRegimen
        .filter((nombre) => !nombresRegimenExistentes.has(nombre))
        .map((nombre) => ({ id: IdentityGenerator.generateId(), nombre }));
    if (regimenesNuevos.length > 0) {
        await prisma.regimen_pension.createMany({ data: regimenesNuevos });
    }

    // Seed de tipo de AFP
    const spp = await prisma.regimen_pension.findFirstOrThrow({ where: { nombre: 'SPP' } });
    await Promise.all(['INTEGRA', 'PRIMA', 'PROFUTURO', 'HABITAT'].map(async (nombre) => {
        const afp = await prisma.tipo_afp.findFirst({ where: { nombre, id_regimen: spp.id } });
        if (!afp) {
            await prisma.tipo_afp.create({ data: { id: IdentityGenerator.generateId(), nombre, id_regimen: spp.id } });
        }
    }));
}
