import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { ExportacionesController } from './controller/exportaciones.controller';
import { N8nInternoController } from './controller/n8n-interno.controller';
import { DespachoN8nService } from './services/despacho-n8n.service';
import { DatosExportacionService } from './services/datos-exportacion.service';
import { CrearTrabajoIntegracionUseCase } from './use-cases/crearTrabajoIntegracion.useCase';
import { AtenderTrabajoN8nUseCase } from './use-cases/atenderTrabajoN8N.useCase';
import { ConsultarTrabajoIntegracionUseCase } from './use-cases/consultarTrabajoIntegracion.useCase';

@Module({
    imports: [PrismaModule],
    controllers: [ExportacionesController, N8nInternoController],
    providers: [
        DespachoN8nService,
        DatosExportacionService,
        CrearTrabajoIntegracionUseCase,
        AtenderTrabajoN8nUseCase,
        ConsultarTrabajoIntegracionUseCase,
    ],
    exports: [
        CrearTrabajoIntegracionUseCase,
        ConsultarTrabajoIntegracionUseCase,
    ],
})
export class IntegracionesModule {}
