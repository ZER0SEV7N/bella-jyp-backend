//src/modules/afp/afp.module.ts
import { Module } from '@nestjs/common';
import { AfpController } from './controller/afp.controller';
//aportaciones
import { AgregarAportacionUseCase } from './use-cases/aportacion/agregarAportacion.useCase';
import { ListarAportacionesUseCase } from './use-cases/aportacion/listarAportacion.useCase';
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
    //aportaciones
    AgregarAportacionUseCase,
    ListarAportacionesUseCase,
    //comisiones
    AgregarComisionUseCase,
    ListarComisionesUseCase,
    //afps
    AgregarTipoAfpUseCase,
    ListarTiposAfpUseCase,
  ],
  exports: [
    AgregarAportacionUseCase,
    ListarAportacionesUseCase,
    AgregarComisionUseCase,
    ListarComisionesUseCase,
    AgregarTipoAfpUseCase,
    ListarTiposAfpUseCase,
  ],
})
export class AfpModule {}
