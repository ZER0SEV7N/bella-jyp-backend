import { IdentityGenerator } from '../../src/common/utils/uuid.util';
import { ClienteSeed } from './vigencias.helper';

/** Catálogos sin empleados ni usuarios. Busca por nombre para no duplicar registros existentes. */
export async function seedBancosAfpComisiones(prisma: ClienteSeed) {
    for (const nombre of ['BANCO DE CREDITO DEL PERU (BCP)', 'BBVA PERU', 'INTERBANK', 'SCOTIABANK PERU', 'BANBIF', 'BANCO PICHINCHA', 'BANCO DE LA NACION']) {
        const banco = await prisma.bancos.findFirst({ where: { nombre } });
        if (!banco) {
            await prisma.bancos.create({ data: { id: IdentityGenerator.generateId(), nombre } });
        }
    }
    for (const tipo_documento of ['DNI', 'CE', 'PASAPORTE']) {
        await prisma.tipo_documento.upsert({ where: { tipo_documento }, update: {}, create: { id: IdentityGenerator.generateId(), tipo_documento } });
    }
    for (const nombre of ['ONP', 'SPP']) {
        const regimen = await prisma.regimen_pension.findFirst({ where: { nombre } });
        if (!regimen) {
            await prisma.regimen_pension.create({ data: { id: IdentityGenerator.generateId(), nombre } });
        }
    }
    const spp = await prisma.regimen_pension.findFirstOrThrow({ where: { nombre: 'SPP' } });
    for (const nombre of ['INTEGRA', 'PRIMA', 'PROFUTURO', 'HABITAT']) {
        const afp = await prisma.tipo_afp.findFirst({ where: { nombre, id_regimen: spp.id } });
        if (!afp) {
            await prisma.tipo_afp.create({ data: { id: IdentityGenerator.generateId(), nombre, id_regimen: spp.id } });
        }
    }
}
