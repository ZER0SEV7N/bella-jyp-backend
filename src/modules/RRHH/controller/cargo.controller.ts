//src/modules/RRHH/controller/cargo.controller.ts
//Controlador para manejar las operaciones relacionadas con los cargos en el módulo de RRHH
import { Controller,Post, Body, HttpCode, HttpStatus, Put, Param, Patch, Delete, UseGuards, } from '@nestjs/common';
//validacion de estructura de datos mediate el zod
import type { dtoCreateCargoInput, dtoEditCargoInput, dtoEliminarCargoInput, } from '@jyp/shared-contracts';
//casos de uso
import { CrearCargoUseCase} from '../use-cases/cargos/crearCargo.UseCase';
import { ActualizarCargoUseCase } from '../use-cases/cargos/actualizarCargo.UseCase';
import { EliminarCargoUseCase } from '../use-cases/cargos/eliminarCargo.UseCase';
import { ActiveCargoUseCase } from '../use-cases/cargos/activeCargo.useCase';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';

//Controller para manejar las operaciones relacionadas con los cargos en el módulo de RRHH
@Controller('api/rrhh/cargo')
@UseGuards(JwtAccessGuard)
export class CargoController {
  constructor(
    private readonly crearCargoUseCase: CrearCargoUseCase,
    private readonly actualizarCargoUseCase: ActualizarCargoUseCase,
    private readonly eliminarCargoUseCase: EliminarCargoUseCase,
    private readonly reactiveCargoUseCase: ActiveCargoUseCase,
  ) {}

  /**
   * Crear un nuevo cargo
   * @url http://localhost:3000/api/rrhh/cargo/crear
   * @param payload {
   *  "id_area" : id string - uuid
   *  "nombre" : "nombre de area"
   *  "descripcion" : "decripcionm"
   * }
   */
  @Post('crear')
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() payload: dtoCreateCargoInput) {
    return await this.crearCargoUseCase.execute(payload);
  }

  /**
   *editar cargo
   * @url http://localhost:3000/api/rrhh/cargo/@param /actualizar
   * @param id string - uuid
   * @param payload {
   *  "id_area" : id string - uuid
   *  "nombre" : "nombre de area"
   *  "descripcion" : "decripcionm"
   * }
   */
  @Put(':id/actualizar')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() payload: dtoEditCargoInput) {
    return await this.actualizarCargoUseCase.execute(id, payload);
  }
  /**
   *editar cargo
   * @url http://localhost:3000/api/rrhh/cargo/@param /desactive
   * @param id string - uuid
   */
  @Delete(':id/desactive')
  @HttpCode(HttpStatus.OK)
  async eliminar(@Param('id') id: string) {
    return await this.eliminarCargoUseCase.execute(id);
  }
  //reactive cargo
  /**
   * @param id - string - uuid
   * @URL : http://localhost:3000/api/rrhh/cargo/ @Param /reactive
   */
  @Patch(':id/reactive')
  @HttpCode(HttpStatus.OK)
  async reactive(@Param('id') id: string) {
    return await this.reactiveCargoUseCase.execute(id);
  }
}
