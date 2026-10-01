//prisma/seed.ts
import 'dotenv/config'; // Carga DATABASE_URL desde .env
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { seedBancosAfpComisiones } from './seeders/bancos-afp-comisiones.seeder';
import { seedParametrosLegales } from './seeders/parametros-legales.seeder';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error('DATABASE_URL no está definida en las variables de entorno (.env)');


/**
 * Seeder principal para poblar la base de datos con datos maestros.
 * Este script ejecuta los seeders específicos para bancos, AFPs, comisiones y parámetros legales.
 * Se recomienda ejecutar este script en un entorno de desarrollo o pruebas, ya que puede sobrescribir datos existentes.
 */
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando ejecución de seeders...');
  
  //Catálogos base, entidades bancarias y administradoras de pensión
  await seedBancosAfpComisiones(prisma);

  //Parámetros legales y normativos peruanos (RMV, UIT, porcentajes)
  await seedParametrosLegales(prisma);

  console.log('Base de datos sembrada con éxito.');
}

main()
  .catch((e) => {
    console.error('Error ejecutando seeders:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); 
  });