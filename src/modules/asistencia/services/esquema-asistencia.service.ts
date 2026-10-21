//src/modules/asistencia/services/esquema-asistencia.service.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, OnModuleInit } from '@nestjs/common';

/**
 * Servicio para verificar la instalación de la migración de esquema de asistencia.
 * Este servicio se ejecuta al iniciar el módulo y verifica si la migración 'asistencia_version_migracion()' ha sido aplicada.
 * Si la migración no está instalada, lanza un error indicando que se debe aplicar la migración antes de iniciar esta versión.
 * @requires - PrismaService para acceder a la base de datos y ejecutar consultas SQL.
 * @returns - Promesa que se resuelve con un valor booleano indicando si la migración está instalada.
 */
@Injectable()
export class EsquemaAsistenciaService implements OnModuleInit {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Método que se ejecuta al iniciar el módulo para verificar la instalación de la migración de esquema de asistencia.
     * Ejecuta una consulta SQL para comprobar si la función 'asistencia_version_migracion()' está disponible en la base de datos.
     * Si la función no está instalada, lanza un error indicando que se debe aplicar la migración antes de iniciar esta versión.
     * @returns - Promesa que se resuelve con un valor booleano indicando si la migración está instalada.
     * @throws - Error si la migración no está instalada, indicando que se debe aplicar la migración antes de iniciar esta versión.
     */
    async onModuleInit(): Promise<void> {
        const [control] = await this.prisma.$queryRaw<{ instalada: boolean }[]>`SELECT to_regprocedure('asistencia_version_migracion()') IS NOT NULL AS instalada`;
        if (!control?.instalada) throw new Error('Debe aplicar la migración 20261015150000_asistencia_payroll_estable antes de iniciar esta versión.');
    }
}
