//src/modules/RRHH/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { AsistenciaModule } from '@/modules/asistencia/asistencia.module';
import { DashboardController } from './controllers/dashboard.controller';
import { ObtenerDashboardRrhhUseCase } from './use-cases/obtenerDashboardRrhh.useCase';

/**
 * Módulo del dashboard de RRHH.
 */
@Module({
  imports: [AsistenciaModule],
  controllers: [DashboardController],
  providers: [ObtenerDashboardRrhhUseCase],
})
export class DashboardModule {}
