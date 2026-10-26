//src/modules/asistencia/asistencia.module.ts

import { Module } from '@nestjs/common';
import { AsistenciaController } from './controller/asistencias.controller';
import { IncidenciasController } from './controller/incidencias.controller';
import { AprobarIncidenciaMesUseCase } from './use-cases/Incidencias/aprobarIncidenciaMes.useCase';
import { GenerarIncidenciasMesUseCase } from './use-cases/Incidencias/generarIncidenciasMes.useCase';
import { ListarIncidenciasMesUseCase } from './use-cases/Incidencias/listarIncidenciasMes.useCase';
import { CrearMarcacionManualUseCase } from './use-cases/asistencias/crearMarcacionManual.useCase';
import { ListarMarcacionesUseCase } from './use-cases/asistencias/listarMarcaciones.useCase';
import { AprobacionMasivaAsistenciaService } from './services/aprobacion-masiva-asistencia.service';
import { EsquemaAsistenciaService } from './services/esquema-asistencia.service';
import { GeneracionMasivaAsistenciaService } from './services/generacion-masiva-asistencia.service';
import { GenerarIncidenciaEmpleadoUseCase } from './use-cases/Incidencias/generarIncidenciaEmpleado.useCase';
import { ResolverIncidenciaUseCase } from './use-cases/Incidencias/resolverIncidencia.useCase';
import { AsignarJornadaAsistenciaUseCase } from './use-cases/asistencias/asignarJornadaAsistencia.useCase';
import { GuardarDescansoAsistenciaUseCase } from './use-cases/asistencias/guardarDescansoAsistencia.useCase';
import { ImportarMarcacionesUseCase } from './use-cases/asistencias/importarMarcaciones.useCase';
import { ObtenerDetalleAsistenciaUseCase } from './use-cases/asistencias/obtenerDetalleAsistencia.useCase';
import { ResolverDiaAsistenciaUseCase } from './use-cases/asistencias/resolverDiaAsistencia.useCase';
import { ValidarImportacionMarcacionesUseCase } from './use-cases/asistencias/validarImportacionMarcaciones.useCase';
import { GestionAsistenciaController } from './controller/gestion-asistencia.controller';
import { ImportacionAsistenciaController } from './controller/importacion-asistencia.controller';
import { ImportarMarcacionesService } from './services/importar-marcaciones.service';

/**
 * Módulo de Asistencia
 * Este módulo encapsula toda la funcionalidad relacionada con la gestión de incidencias de asistencia.
 * Incluye controladores, servicios y casos de uso necesarios para procesar y generar incidencias de asistencia
 */
@Module({
    imports: [],
    controllers: [IncidenciasController, AsistenciaController, GestionAsistenciaController, ImportacionAsistenciaController],
    providers: [
        ValidarImportacionMarcacionesUseCase,
        ImportarMarcacionesUseCase,
        EsquemaAsistenciaService,
        AprobacionMasivaAsistenciaService,
        GeneracionMasivaAsistenciaService,
        AsignarJornadaAsistenciaUseCase,
        ObtenerDetalleAsistenciaUseCase,
        ResolverDiaAsistenciaUseCase,
        GuardarDescansoAsistenciaUseCase,
        GenerarIncidenciaEmpleadoUseCase,
        ResolverIncidenciaUseCase,
        ImportarMarcacionesService,
        GenerarIncidenciasMesUseCase,
        CrearMarcacionManualUseCase,
        AprobarIncidenciaMesUseCase,
        ListarIncidenciasMesUseCase,
        ListarMarcacionesUseCase
    ],
    exports: []
})
export class AsistenciaModule {}
