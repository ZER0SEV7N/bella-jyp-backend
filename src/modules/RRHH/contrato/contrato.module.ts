import { Module } from '@nestjs/common';
//use case
import { CrearContratoUseCase } from './use-cases/crearContrato.useCase';
import { RenovarContratoUseCase } from './use-cases/renovarContrato.useCase';
import { EditarContratoUseCase } from './use-cases/editarContrato.useCase';
import { EliminarContratoUseCase } from './use-cases/eliminarContrato.useCase';
//controller
import { ContratoController } from './controller/contrato.controller';
import { VerificarExpiracionContratosUseCase } from './use-cases/verificarExpiracion.useCase';
import { ScheduleModule } from '@nestjs/schedule';
import { ContratosCron } from './cron/contratos.cron';
@Module({
  imports: [ScheduleModule.forRoot() ],
  controllers: [ContratoController],
  providers: [
    ContratosCron,
    VerificarExpiracionContratosUseCase,
    CrearContratoUseCase,
    RenovarContratoUseCase,
    EditarContratoUseCase,
    EliminarContratoUseCase,
    RenovarContratoUseCase,
  ],
})
export class ContratoModule {}
