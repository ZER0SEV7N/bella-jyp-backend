//src/modules/tareas/tareas.module.ts
//Modulo de Tareas: Este módulo encapsula toda la funcionalidad relacionada con la gestión de tareas dentro del sistema.
import { Module } from '@nestjs/common';
import { TareasController } from './controller/tareas.controller';
import { CrearTareaUseCase } from './use-cases/crearTarea.useCase';
import { ObtenerTareasUseCase } from './use-cases/obtenerTareas.useCase';
import { FlujoTareasUseCase } from './use-cases/flujoTareas.useCase';

@Module({
  controllers: [TareasController],
  providers: [CrearTareaUseCase, ObtenerTareasUseCase, FlujoTareasUseCase],
})
export class TareasModule {}
