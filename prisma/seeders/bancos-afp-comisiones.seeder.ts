//prisma/seeders/bancos-afp-comisiones.seeder.ts
import { PrismaClient } from '@prisma/client';

/**
 * Seeder para poblar la base de datos con datos maestros relacionados a Bancos, AFPs y Comisiones.
 * Este script inserta o actualiza registros en las tablas de bancos, regímenes de pensión, tipos de AFP, comisiones de AFP y parámetros legales.
 */
export async function seedBancosAfpComisiones(prisma: PrismaClient) {
  console.log('Sembrando Bancos oficiales de Perú...');
  const bancosData = [
    { id: '018f4a7c-4444-7000-d000-000000000001', nombre: 'BANCO DE CREDITO DEL PERU (BCP)' },
    { id: '018f4a7c-4444-7000-d000-000000000002', nombre: 'BBVA PERU' },
    { id: '018f4a7c-4444-7000-d000-000000000003', nombre: 'INTERBANK' },
    { id: '018f4a7c-4444-7000-d000-000000000004', nombre: 'SCOTIABANK PERU' },
    { id: '018f4a7c-4444-7000-d000-000000000005', nombre: 'BANBIF' },
    { id: '018f4a7c-4444-7000-d000-000000000006', nombre: 'BANCO PICHINCHA' },
    { id: '018f4a7c-4444-7000-d000-000000000007', nombre: 'BANCO DE LA NACION' },
  ];

  for (const b of bancosData) {
    await prisma.bancos.upsert({
      where: { id: b.id },
      update: { nombre: b.nombre },
      create: b,
    });
  }

  console.log('Sembrando Regímenes de Pensión (ONP y SPP)...');
  const regOnpId = '018f4a7c-4444-7000-d000-000000000010';
  const regAfpId = '018f4a7c-4444-7000-d000-000000000020';

  await prisma.regimen_pension.upsert({
    where: { id: regOnpId },
    update: { nombre: 'ONP - SISTEMA NACIONAL DE PENSIONES (D.L. 19990)' },
    create: { id: regOnpId, nombre: 'ONP - SISTEMA NACIONAL DE PENSIONES (D.L. 19990)' },
  });

  await prisma.regimen_pension.upsert({
    where: { id: regAfpId },
    update: { nombre: 'SPP - SISTEMA PRIVADO DE PENSIONES' },
    create: { id: regAfpId, nombre: 'SPP - SISTEMA PRIVADO DE PENSIONES' },
  });

  console.log('Sembrando Administradoras de Fondos de Pensiones (AFPs)...');
  const afps = [
    { id: '018f4a7c-4444-7000-d000-000000000101', nombre: 'INTEGRA', id_regimen: regAfpId },
    { id: '018f4a7c-4444-7000-d000-000000000102', nombre: 'PRIMA', id_regimen: regAfpId },
    { id: '018f4a7c-4444-7000-d000-000000000103', nombre: 'PROFUTURO', id_regimen: regAfpId },
    { id: '018f4a7c-4444-7000-d000-000000000104', nombre: 'HABITAT', id_regimen: regAfpId },
  ];

  for (const afp of afps) {
    await prisma.tipo_afp.upsert({
      where: { id: afp.id },
      update: { nombre: afp.nombre, id_regimen: afp.id_regimen },
      create: afp,
    });
  }

  console.log('Sembrando Comisiones de AFP SBS...');
  const comisionesData = [
    {
      id: '018f4a7c-4444-7000-d000-000000000201',
      afp_id: '018f4a7c-4444-7000-d000-000000000101', // INTEGRA
      aporte_obligatorio: 10.0,
      prima_seguro: 1.84,
      comision_sobre_ra: 1.55,
      comision_mixta: 0.0,
      periodo_inicio: new Date('2026-01-01'),
      periodo_final: null,
    },
    {
      id: '018f4a7c-4444-7000-d000-000000000202',
      afp_id: '018f4a7c-4444-7000-d000-000000000102', // PRIMA
      aporte_obligatorio: 10.0,
      prima_seguro: 1.84,
      comision_sobre_ra: 1.60,
      comision_mixta: 0.18,
      periodo_inicio: new Date('2026-01-01'),
      periodo_final: null,
    },
    {
      id: '018f4a7c-4444-7000-d000-000000000203',
      afp_id: '018f4a7c-4444-7000-d000-000000000103', // PROFUTURO
      aporte_obligatorio: 10.0,
      prima_seguro: 1.84,
      comision_sobre_ra: 1.69,
      comision_mixta: 0.20,
      periodo_inicio: new Date('2026-01-01'),
      periodo_final: null,
    },
    {
      id: '018f4a7c-4444-7000-d000-000000000204',
      afp_id: '018f4a7c-4444-7000-d000-000000000104', // HABITAT
      aporte_obligatorio: 10.0,
      prima_seguro: 1.84,
      comision_sobre_ra: 1.47,
      comision_mixta: 0.23,
      periodo_inicio: new Date('2026-01-01'),
      periodo_final: null,
    },
  ];

  for (const c of comisionesData) {
    await prisma.comisiones_afp.upsert({
      where: { id: c.id },
      update: {
        aporte_obligatorio: c.aporte_obligatorio,
        prima_seguro: c.prima_seguro,
        comision_sobre_ra: c.comision_sobre_ra,
        comision_mixta: c.comision_mixta,
        periodo_final: c.periodo_final,
      },
      create: c,
    });
  }
}