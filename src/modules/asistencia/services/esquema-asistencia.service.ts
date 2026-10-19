import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, OnModuleInit } from '@nestjs/common';

/** Comprueba al iniciar que las funciones SQL requeridas estén instaladas. */
@Injectable()
export class EsquemaAsistenciaService implements OnModuleInit {
    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit(): Promise<void> {
        const [control] = await this.prisma.$queryRaw<
            { instalada: boolean }[]
        >`SELECT to_regprocedure('asistencia_version_migracion()') IS NOT NULL AS instalada`;
        if (!control?.instalada) throw new Error('Debe aplicar la migración 20261015150000_asistencia_payroll_estable antes de iniciar esta versión.');
    }
}
