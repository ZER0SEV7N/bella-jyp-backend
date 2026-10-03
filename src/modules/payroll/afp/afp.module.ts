//src/modules/afp/afp.module.ts
import { Module } from '@nestjs/common';
import { AfpController } from './controller/afp.controller';

//comisiones
import { AgregarComisionUseCase } from './use-cases/comision/agregarComision.useCase';
import { ListarComisionesUseCase } from './use-cases/comision/listarComision.useCase';
//tipo de afp
import { AgregarTipoAfpUseCase } from './use-cases/tipo-afp/agregarTipoAfp.useCase';
import { ListarTiposAfpUseCase } from './use-cases/tipo-afp/listarTipoAfp.useCase';

/**
 * Módulo de AFP.
 * Este módulo agrupa todos los controladores y casos de uso relacionados con las AFP, incluyendo la gestión de aportaciones, comisiones y tipos de AFP.
 * @module afpModule
 * @controller afpController
 * @useCases AgregarAportacionUseCase, ListarAportacionesUseCase, AgregarComisionUseCase, ListarComisionesUseCase, AgregarTipoAfpUseCase, ListarTiposAfpUseCase
 */
@Module({
  controllers: [AfpController],
  providers: [
    //comisiones
    AgregarComisionUseCase,
    ListarComisionesUseCase,
    //afps
    AgregarTipoAfpUseCase,
    ListarTiposAfpUseCase,
  ],
  exports: [
    AgregarComisionUseCase,
    ListarComisionesUseCase,
    AgregarTipoAfpUseCase,
    ListarTiposAfpUseCase,
  ],
})
export class AfpModule {}
