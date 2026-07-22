import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Put,
  Param,
  Delete,
  Patch,
} from '@nestjs/common';
//validacion de estructura de datos mediate el zod
import type {
  dtoCreateCargoInput,
  dtoEditCargoInput,
} from '@jyp/shared-contracts';
//casos de uso
import {
  CrearCargoUseCase,
  DeleteCargoUseCase,
  UpdateCargoUseCase,
  ActiveCargoUseCase,
} from '../use-cases/cargos';

@Controller('api/rrhh/cargo')
export class CargoController {
  constructor(
    private readonly crearCargoUseCase: CrearCargoUseCase,
    private readonly updateCargoUseCase: UpdateCargoUseCase,
    private readonly deleteCargoUseCase: DeleteCargoUseCase,
    private readonly reactiveCargoUseCase: ActiveCargoUseCase,
  ) {}

  /**
   *crear cargo
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
    return await this.updateCargoUseCase.execute(id, payload);
  }
  /**
   *editar cargo
   * @url http://localhost:3000/api/rrhh/cargo/@param /desactive
   * @param id string - uuid
   */
  @Delete(':id/desactive')
  @HttpCode(HttpStatus.OK)
  async eliminar(@Param('id') id: string) {
    return await this.deleteCargoUseCase.execute(id);
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
