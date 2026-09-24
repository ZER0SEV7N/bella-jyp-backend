//src/modules/RRHH/solicitudes/solicitud.module.ts
import { Module } from '@nestjs/common';
//Casos de uso
import { SolicitudController } from './controller/solicitud.controller';
import { AsignarRevisionDeSolicitudUseCase } from './use-cases/asignarRevisionDeSolicitud.useCase';
import { CrearSolicitudUseCase } from './use-cases/crearSolicitud.useCase';
import { ObtenerDetalleSolicitudUseCase } from './use-cases/obtenerDetalleSolicitud.useCase';
import { AnularSolicitudUseCase } from './use-cases/anularSolicitud.useCase';
import { EvaluarSolicitudUseCase } from './use-cases/evaluarSolicitud.useCase';
//Servicios
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Módulo de Solicitudes del sistema de RRHH
 * Este módulo encapsula toda la funcionalidad relacionada con la gestión de solicitudes dentro del sistema de Recursos Humanos.
 * Contiene los casos de uso, controladores y servicios necesarios para crear, asignar, evaluar, obtener detalles y anular solicitudes.
 * @Module Decorador que define el módulo de Solicitudes y sus dependencias.
 */
@Module({
    controllers: [SolicitudController],
    providers: [
        PrismaService,
        CrearSolicitudUseCase,
        ObtenerDetalleSolicitudUseCase,
        AsignarRevisionDeSolicitudUseCase,
        EvaluarSolicitudUseCase,
        AnularSolicitudUseCase
    ]
})
export class SolicitudModule {}