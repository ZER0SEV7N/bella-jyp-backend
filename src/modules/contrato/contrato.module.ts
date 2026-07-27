import { Module } from '@nestjs/common';
import { CrearContratoUseCase } from './use-cases/crearContrato.useCase';
import { ContratoController } from './controller/contarto.controller';
@Module({
  imports: [],
  controllers: [ContratoController],
  providers: [CrearContratoUseCase],
})
export class ContratoModule {}
