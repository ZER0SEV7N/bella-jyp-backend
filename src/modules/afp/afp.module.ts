import { Module } from '@nestjs/common';
import { afpController } from './controller/afp.controller';
//aportaciones
import { agregarAportacionUseCase } from './use-cases/aportaciones/agregarAportacion.useCse';
//comisiones
import { agregarComisionUseCase } from './use-cases/comisiones/agregarComision.useCase';
//tipo de afp
import { agregarTipoAfpUseCase } from './use-cases/tipoAfp/agregarAfp.useCase';
@Module({
  controllers: [afpController],
  providers: [
    //aportaciones
    agregarAportacionUseCase,
    //comisiones
    agregarComisionUseCase,
    //afps
    agregarTipoAfpUseCase,
  ],
})
export class afpModule {}
