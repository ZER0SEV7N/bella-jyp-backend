//src/modules/core/audit/audit.module.ts
//Modulo para todo lo que tiene que ver con la auditoria de la aplicacion, como logs de eventos, cambios en la base de datos, etc.
import { Module } from '@nestjs/common';
import { AuditController } from './controller/audit.controller';
import { ObtenerLogsUseCase } from './use-cases/obtenerLogs.useCase';
import { RegistroAuditoriaUseCase } from './use-cases/registroAuditoria.useCase';
import { ClsModule } from 'nestjs-cls';

@Module({
  imports: [ClsModule],
  controllers: [AuditController],
  providers: [ObtenerLogsUseCase, RegistroAuditoriaUseCase],
  exports: [ObtenerLogsUseCase, RegistroAuditoriaUseCase],
})
export class AuditModule {}
