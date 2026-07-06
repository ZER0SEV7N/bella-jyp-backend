import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Put,
  Param,
  Patch,
} from '@nestjs/common';
//validacion de estructura de datos mediate el zod
import type {
  dtoCreateCargoInput,
  dtoEditCargoInput,
  dtoEliminarCargoInput,
} from '@jyp/shared-contracts';
//casos de uso
import {
  CrearCargoUseCase,
  DeleteCargoUseCase,
  UpdateCargoUseCase,
} from '../use-cases/cargos';

@Controller('api/rrhh/cargo')
export class CargoController {
  constructor(
    private readonly crearCargoUseCase: CrearCargoUseCase,
    private readonly updateCargoUseCase: UpdateCargoUseCase,
    private readonly deleteCargoUseCase: DeleteCargoUseCase,
  ) {}
  @Post('crear')
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() payload: dtoCreateCargoInput) {
    return await this.crearCargoUseCase.execute(payload);
  }

  @Put('actualizar/:id')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() payload: dtoEditCargoInput) {
    return await this.updateCargoUseCase.execute(id, payload);
  }
  @Put('eliminar/:id')
  @HttpCode(HttpStatus.OK)
  async eliminar(@Body() payload: dtoEliminarCargoInput) {
    return await this.deleteCargoUseCase.execute(payload);
  }
}
