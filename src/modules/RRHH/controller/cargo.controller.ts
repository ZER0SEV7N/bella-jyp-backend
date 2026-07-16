import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Put,
  Param,
  Delete,
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

  @Put(':id/actualizar')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() payload: dtoEditCargoInput) {
    return await this.updateCargoUseCase.execute(id, payload);
  }
  @Delete(':id/delete')
  @HttpCode(HttpStatus.OK)
  async eliminar(@Param('id') id: string) {
    return await this.deleteCargoUseCase.execute(id);
  }
}
