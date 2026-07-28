import { Module } from '@nestjs/common';
//use case
import { CrearContratoUseCase } from './use-cases/crearContrato.useCase';
import { RenovarContratoUseCase } from './use-cases/renovarContrato.useCase';
import { EditarContratoUseCase } from './use-cases/editarContrato.useCase';
import { EliminarContratoUseCase } from './use-cases/eliminarContrato.useCase';
//controller
import { ContratoController } from './controller/contarto.controller';
@Module({
  imports: [],
  controllers: [ContratoController],
  providers: [
    CrearContratoUseCase,
    RenovarContratoUseCase,
    EditarContratoUseCase,
    EliminarContratoUseCase,
    RenovarContratoUseCase,
  ],
})
export class ContratoModule {}
