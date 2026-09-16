//src/modules/RRHH/organizacion/RRHH.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ClsModule } from 'nestjs-cls';
// --- CONTROLADORES ---
import { AreaController } from './controller/area.controller';
import { CargoController } from './controller/cargo.controller';
import { EmpleadoController } from './controller/empleado.controller';
import { EmpleadoBulkController } from './controller/empleado-bulk.controller';
import { JornadaController } from './controller/jornada.controller';
// --- CASOS DE USO: ÁREA ---
import { CrearAreaUseCase } from './use-cases/area/crearArea.useCase';
import { EditarAreaUseCase } from './use-cases/area/editarArea.useCase';
import { EstadoAreaUseCase } from './use-cases/area/estadoArea.useCase';
import { ListarAreasUseCase } from './use-cases/area/listarAreas.useCase';
// --- CASOS DE USO: CARGO ---
import { CrearCargoUseCase } from './use-cases/cargos/crearCargo.useCase';
import { EditarCargoUseCase } from './use-cases/cargos/editarCargo.useCase';
import { EstadoCargoUseCase } from './use-cases/cargos/estadoCargo.useCase';
import { ListarCargosUseCase } from './use-cases/cargos/listarCargos.useCase';
// --- CASOS DE USO: EMPLEADO ---
import { CrearEmpleadoUseCase } from './use-cases/empleado/crearEmpleado.useCase';
import { ListarEmpleadosUseCase } from './use-cases/empleado/listarEmpleados.useCase';
import { EditarEmpleadoUseCase } from './use-cases/empleado/editarEmpleado.useCase';
import { EstadoEmpleadoUseCase } from './use-cases/empleado/estadoEmpleado.useCase';
// --- CASOS DE USO: CARGA MASIVA ---
import { ConsultarEstadoCargaMasivaUseCase } from './use-cases/carga-masiva/consultarEstadoCargaMasiva.useCase';
import { ProcesarFilaEmpleadoUseCase } from './use-cases/carga-masiva/procesarFilaEmpleado.useCase';
import { ValidarCargaMasivaUseCase } from './use-cases/carga-masiva/validarCargaMasiva.useCase';
import { ConfirmarCargaMasivaUseCase } from './use-cases/carga-masiva/confirmarCargaMasiva.useCase';
// --- CASOS DE USO: JORNADAS ---
import { CrearJornadaUseCase } from './use-cases/jornadas/crearJornada.useCase';
import { EditarJornadaUseCase } from './use-cases/jornadas/editarJornada.useCase';
import { EstadoJornadaUseCase } from './use-cases/jornadas/estadoJornada.useCase';
import { ListarJornadaUseCase } from './use-cases/jornadas/listarJornada.useCase';

// --- SERVICIOS Y WORKERS ---
import { ReniecAdapter } from './services/reniec.adapter';
import { CargaMasivaProcessor } from '@/workers/carga-masiva/carga-masiva.processor';

@Module({
  imports: [
    // Importamos la cola para poder inyectarla en el Carga Masiva UseCase
    BullModule.registerQueue({ name: 'rrhh-bulk-queue' }),
    ClsModule
  ],
  controllers: [
    AreaController,
    CargoController,
    EmpleadoController,
    EmpleadoBulkController,
    JornadaController,
  ],
  providers: [
    //Areas
    CrearAreaUseCase,
    EditarAreaUseCase,
    EstadoAreaUseCase,
    ListarAreasUseCase,
    //Cargos
    CrearCargoUseCase,
    EditarCargoUseCase,
    EstadoCargoUseCase,
    ListarCargosUseCase,
    //Empleados
    CrearEmpleadoUseCase,
    ListarEmpleadosUseCase,
    EditarEmpleadoUseCase,
    EstadoEmpleadoUseCase,
    //Carga Masiva
    ConsultarEstadoCargaMasivaUseCase,
    ProcesarFilaEmpleadoUseCase,
    CargaMasivaProcessor,
    ValidarCargaMasivaUseCase,
    ConfirmarCargaMasivaUseCase,
    //Jornadas
    CrearJornadaUseCase,
    EditarJornadaUseCase,
    EstadoJornadaUseCase,
    ListarJornadaUseCase,
    //Adaptadores Externos
    ReniecAdapter
  ],
})
export class OrganizacionModule {}
