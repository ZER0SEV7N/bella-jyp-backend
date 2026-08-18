//src/modules/payroll/datoFinanciero/datosFinanciero.module.ts
import { Module } from '@nestjs/common';
import { DatoFinancieroController } from './controller/datoFinanciero.controller';
import { AgregarDatoFinancieroUseCase } from './use-case/agregarDatoFinanciero.useCase';
import { EditarDatoFinancieroUseCase } from './use-case/editarDatoFinanciero.useCase';
import { ObtenerDatoFinancieroUseCase } from './use-case/obtenerDatoFinanciero.useCase';

/**
 * Módulo de datos financieros que encapsula el controlador y los casos de uso relacionados con la gestión de datos financieros de los empleados.
 * Proporciona funcionalidades para agregar, editar y obtener datos financieros, asegurando la seguridad y confidencialidad de la información sensible.
 * Este módulo es parte del sistema de nómina y está diseñado para ser utilizado por usuarios con roles específicos (ADMIN, CONTADOR, RRHH, ASISTENTE).
 */
@Module({
  controllers: [DatoFinancieroController],
  providers: [
    AgregarDatoFinancieroUseCase,
    EditarDatoFinancieroUseCase,
    ObtenerDatoFinancieroUseCase
  ],
  exports: [
    AgregarDatoFinancieroUseCase,
    EditarDatoFinancieroUseCase,
    ObtenerDatoFinancieroUseCase
  ]
})
export class DatosFinancieroModule {}