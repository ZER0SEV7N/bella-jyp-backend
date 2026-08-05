import { Module } from '@nestjs/common';
import { afpController } from './controller/afp.controller';
//aportaciones
import { AgregarAportacionUseCase } from './use-cases/aportaciones/agregarAportacion.useCse';
//comisiones
import { AgregarComisionUseCase } from './use-cases/comisiones/agregarComision.useCase';
//tipo de afp
import { AgregarTipoAfpUseCase } from './use-cases/tipoAfp/agregarAfp.useCase';
@Module({
  controllers: [afpController],
  providers: [
    //aportaciones
    AgregarAportacionUseCase,
    //comisiones
    AgregarComisionUseCase,
    //afps
    AgregarTipoAfpUseCase,
  ],
})
export class afpModule {}
