//src/modules/asistencia/asistencia.module.ts
import { Module } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import { IncidenciasController } from "./controller/incidencias.controller";
import { GenerarIncidenciasMesUseCase } from "./use-cases/incidencias/generarIncidenciasMes.useCase";
import { ClsModule } from "nestjs-cls";
import { BullModule } from "@nestjs/bullmq";

/**
 * Módulo de Asistencia
 * Este módulo encapsula toda la funcionalidad relacionada con la gestión de incidencias de asistencia.
 * Incluye controladores, servicios y casos de uso necesarios para procesar y generar incidencias de asistencia
 */
@Module({
    imports: [
        BullModule.registerQueue({ name: 'asistencia-bulk-queue' }),
        ClsModule
    ],
    controllers: [IncidenciasController],
    providers: [PrismaService, GenerarIncidenciasMesUseCase],
})
export class AsistenciaModule {}