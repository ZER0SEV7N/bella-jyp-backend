//src/modules/RRHH/contrato/contrato.module.ts
import { Module } from '@nestjs/common';
//use case
import { CrearContratoUseCase } from './use-cases/crearContrato.useCase';
import { RenovarContratoUseCase } from './use-cases/renovarContrato.useCase';
import { EditarContratoUseCase } from './use-cases/editarContrato.useCase';
import { AnularContratoUseCase } from './use-cases/anularContrato.useCase';
import { ListarContratoUseCase } from './use-cases/listarContrato.useCase';
import { SubirContratoPdfUseCase } from './use-cases/subirContratoPdf.useCase';
import { VerificarExpiracionContratosUseCase } from './use-cases/verificarExpiracion.useCase';
//Cron
import { ContratosCron } from './cron/contratos.cron';
//controller
import { ContratoController } from './controller/contrato.controller';
//Module
import { ScheduleModule } from '@nestjs/schedule';

/**
 * Módulo de Contratos del sistema de RRHH
 * Este módulo encapsula toda la funcionalidad relacionada con la gestión de contratos dentro del sistema de Recursos Humanos.
 * Contiene los casos de uso, controladores y servicios necesarios para crear, editar, renovar, listar y anular contratos.
 * Además, incluye un cron job para verificar la expiración de los contratos de manera automática.
 * @Module Decorador que define el módulo de Contratos y sus dependencias.
 */
@Module({
  imports: [ScheduleModule.forRoot() ],
  controllers: [ContratoController],
  providers: [
    ContratosCron,
    VerificarExpiracionContratosUseCase,
    CrearContratoUseCase,
    RenovarContratoUseCase,
    EditarContratoUseCase,
    ListarContratoUseCase,
    AnularContratoUseCase,
    SubirContratoPdfUseCase,
    ContratosCron,
    RenovarContratoUseCase,
    VerificarExpiracionContratosUseCase
  ],
})
export class ContratoModule {}
