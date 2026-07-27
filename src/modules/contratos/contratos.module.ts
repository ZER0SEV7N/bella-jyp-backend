import { Module } from '@nestjs/common';
import { CrearContratoUseCase } from './use-cases/crearContrato.useCase';
@Module({
  imports: [],
  controllers: [ContratoModule],
  providers: [CrearContratoUseCase],
})
export class ContratoModule {}
