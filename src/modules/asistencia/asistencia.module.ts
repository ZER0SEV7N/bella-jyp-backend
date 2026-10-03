//src/modules/asistencia/asistencia.module.ts
import { Module } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import { IncidenciasController } from "./controller/incidencias.controller";
import { GenerarIncidenciasMesUseCase } from "./use-cases/Incidencias/generarIncidenciasMes.useCase";
import { CrearMarcacionManualUseCase } from "./use-cases/asistencias/crearMarcacionManual.useCase";
import { AprobarIncidenciaMesUseCase } from "./use-cases/Incidencias/aprobarIncidenciaMes.useCase";
import { AsistenciaController } from "./controller/asistencias.controller";
import { ListarIncidenciasMesUseCase } from "./use-cases/Incidencias/listarIncidenciasMes.useCase";
import { ListarMarcacionesUseCase } from "./use-cases/asistencias/listarMarcaciones.useCase";

/**
 * Módulo de Asistencia
 * Este módulo encapsula toda la funcionalidad relacionada con la gestión de incidencias de asistencia.
 * Incluye controladores, servicios y casos de uso necesarios para procesar y generar incidencias de asistencia
 */
@Module({
    imports: [],
    controllers: [IncidenciasController, AsistenciaController],
    providers: [PrismaService, GenerarIncidenciasMesUseCase, CrearMarcacionManualUseCase, AprobarIncidenciaMesUseCase, ListarIncidenciasMesUseCase, ListarMarcacionesUseCase],
})
export class AsistenciaModule {}