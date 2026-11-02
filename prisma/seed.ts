//prisma/seed.ts
import 'dotenv/config'; // Carga DATABASE_URL desde .env
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { seedBancosAfpComisiones } from './seeders/bancos-afp-comisiones.seeder';
import { seedComisionesOctubre2026 } from './seeders/comisiones-octubre-2026.seeder';
import { seedParametrosLegales } from './seeders/parametros-legales.seeder';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no está definida en las variables de entorno (.env)');
}


/**
 * Seeder principal para poblar la base de datos con datos maestros.
 * Este script ejecuta los seeders específicos para bancos, AFPs, comisiones y parámetros legales.
 * Es idempotente: no borra datos operativos ni sobrescribe tasas existentes. Las discrepancias requieren revisión explícita.
 */
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando ejecución de seeders...');
  
  //Evita que dos procesos siembren simultáneamente catálogos sin clave natural única.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261021)`;
    await seedBancosAfpComisiones(tx);
    await seedParametrosLegales(tx);
    await seedComisionesOctubre2026(tx);
  }, { timeout: 30000 });

  console.log('Base de datos sembrada con éxito.');
}

main()
  .catch((e) => {
    console.error('Error ejecutando seeders:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); 
  });