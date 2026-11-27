//src/modules/core/catalogos/catalogos.module.ts
import { Module } from '@nestjs/common';
import { CatalogosController } from './controller/catalogos.controller';
import { ObtenerCatalogosUseCase } from './use-cases/obtenerCatalogos.useCase';

/**
 * Módulo de catálogos base del core (tipos de documento, regímenes pensionarios
 * y modalidades de contrato). Solo lectura; no tiene persistencia propia.
 */
@Module({
  controllers: [CatalogosController],
  providers: [ObtenerCatalogosUseCase],
})
export class CatalogosModule {}
