//librerias base de nestjs
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
//validacion de estructura de datos mediate el zod
import type {
  dtoCrearAreaInput,
  dtoActualizarAreaInput,
} from '@jyp/shared-contracts';
//casos de uso
import {
  CrearAreaUseCase,
  EliminarAreaUseCase,
  UpdateAreaUseCase,
} from '../use-cases/area';

@Controller('api/rrhh/area')
export class AreaController {
  //constructor de los casos de uso
  constructor(
    private readonly crearAreaUseCase: CrearAreaUseCase,
    private readonly updateAreaUseCase: UpdateAreaUseCase,
    private readonly eliminarAreaUseCase: EliminarAreaUseCase,
  ) {}
  //delete - softdelete
  /**
   * @param id: string
   * @returns {
   *
   * }
   * @URL : http://localhost:3000/api/rrhh/area/ @Param /active
   */
  @Delete(':id/active')
  @HttpCode(HttpStatus.OK)
  async eliminar(@Param('id') id: string) {
    return await this.eliminarAreaUseCase.execute(id);
  }
  //update - total
  /**
   * @param id
   * @param payload
   * @returns
   */
  @Patch('actualizar/:id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() payload: dtoActualizarAreaInput,
  ) {
    return await this.updateAreaUseCase.execute(id, payload);
  }
  //post - crear
  /**
   * @param payload
   * @returns
   */
  @Post('crear')
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() payload: dtoCrearAreaInput) {
    return await this.crearAreaUseCase.execute(payload);
  }
}
