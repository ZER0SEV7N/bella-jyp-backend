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
        if (!control?.instalada) 
            throw new Error('Faltan las protecciones SQL. Base nueva: npm run db:crear. Base existente compatible: npm run db:instalar-objetos. Consulte docs/revision-20261021/INSTALACION.md.');
        
        
        //Una función con el nombre correcto no basta: también deben estar activos los triggers críticos.
        const [protecciones] = await this.prisma.$queryRaw<{ cantidad: number }[]>`
            SELECT count(*)::integer AS cantidad FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = current_schema() AND t.tgenabled <> 'D'
            AND (c.relname, t.tgname) IN (
                ('asistencia_marcacion', 'trg_asistencia_fuentes'), ('asistencia_marcacion', 'trg_asistencia_auditoria'),
                ('asistencia_jornada', 'trg_asistencia_fuentes'), ('solicitud', 'trg_solicitud_auditoria_atomica'),
                ('incidencias_mes', 'trg_asistencia_resumen'), ('historial_planillas', 'trg_proteger_planilla'),
                ('novedad_planilla', 'trg_payroll_novedad'), ('adelanto_desembolso', 'trg_payroll_desembolso'),
                ('parametro_legal', 'trg_parametro_vigencia'), ('comisiones_afp', 'trg_comision_vigencia'))`;

        //Valida que la cantidad de triggers críticos activos sea la esperada (10). Si no es así, lanza un error indicando que faltan triggers críticos o están deshabilitados.
        if (protecciones?.cantidad !== 10) 
            throw new Error('Faltan triggers críticos o están deshabilitados. Ejecute npm run db:instalar-objetos y revise el esquema.');
        

        //Valida que la versión de la migración de esquema de asistencia sea la esperada ('2026-10-21.1'). Si no es así, lanza un error indicando que las protecciones SQL no corresponden a esta revisión y que se debe ejecutar 'npm run db:instalar-objetos' sobre un esquema compatible.
        const [version] = await this.prisma.$queryRaw<{ version: string }[]>`SELECT asistencia_version_migracion() AS version`;
        if (version?.version !== '2026-10-21.1') 
            throw new Error('Las protecciones SQL no corresponden a esta revisión. Ejecute npm run db:instalar-objetos sobre un esquema compatible.');
        
    }
}
