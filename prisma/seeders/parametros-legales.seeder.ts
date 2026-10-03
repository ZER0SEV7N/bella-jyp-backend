//prisma/seeders/parametros-legales.seeder.ts
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export async function seedParametrosLegales(prisma: PrismaClient) {
  const parametros = [
    {
      id: randomUUID(),
      codigo: 'RMV',
      nombre: 'Remuneración Mínima Vital',
      valor: 1130.0,
      vigente_desde: new Date('2024-01-01'),
      vigente_hasta: null,
      descripcion: 'Sueldo mínimo legal y base de cálculo para asignación familiar (10%)'
    },
    {
      id: randomUUID(),
      codigo: 'UIT',
      nombre: 'Unidad Impositiva Tributaria',
      valor: 5500.0,
      vigente_desde: new Date('2026-01-01'),
      vigente_hasta: null,
      descripcion: 'Valor de referencia tributario del ejercicio fiscal 2026'
    },
    {
      id: randomUUID(),
      codigo: 'ESSALUD_PCT',
      nombre: 'Tasa Aporte EsSalud Empleador',
      valor: 0.09,
      vigente_desde: new Date('2020-01-01'),
      vigente_hasta: null,
      descripcion: 'Porcentaje contributivo a cargo del empleador (9%)'
    },
    {
      id: randomUUID(),
      codigo: 'ONP_PCT',
      nombre: 'Tasa Retención Sistema Nacional de Pensiones',
      valor: 0.13,
      vigente_desde: new Date('2020-01-01'),
      vigente_hasta: null,
      descripcion: 'Porcentaje de retención previsional D.L. 19990 (13%)'
    },
    {
      id: randomUUID(),
      codigo: 'DIVISOR_HORAS_MES',
      nombre: 'Divisor Estándar Jornada Mensual',
      valor: 240.0,
      vigente_desde: new Date('2020-01-01'),
      vigente_hasta: null,
      descripcion: 'Base mensual en horas ordinarias (30 días x 8 horas)'
    }
  ];

  for (const p of parametros) {
    await prisma.parametro_legal.upsert({
      where: {
        codigo_vigente_desde: {
          codigo: p.codigo,
          vigente_desde: p.vigente_desde,
        },
      },
      update: {},
      create: p
    });
  }
}