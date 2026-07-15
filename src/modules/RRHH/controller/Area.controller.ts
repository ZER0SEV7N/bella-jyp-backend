//src/modules/RRHH/controller/Area.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus, Put, Param, Patch } from '@nestjs/common';
//validacion de estructura de datos mediate el zod
import type { dtoCrearAreaInput,dtoActualizarAreaInput, dtoEliminarAreaInput, } from '@jyp/shared-contracts';
//casos de uso
import { CrearAreaUseCase, EliminarAreaUseCase, UpdateAreaUseCase, } from '../use-cases/area';

@Controller('api/rrhh/area')
export class AreaController {
  //constructor de los casos de uso
  constructor(
    private readonly crearAreaUseCase: CrearAreaUseCase,
    private readonly updateAreaUseCase: UpdateAreaUseCase,
    private readonly eliminarAreaUseCase: EliminarAreaUseCase,
  ) {}
  //delete - softdelete
  @Patch('eliminar')
  @HttpCode(HttpStatus.OK)
  async eliminar(@Body() payload: dtoEliminarAreaInput) {
    return await this.eliminarAreaUseCase.execute(payload);
  }
  //update - total
  @Put('actualizar/:id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() payload: dtoActualizarAreaInput,
  ) {
    return await this.updateAreaUseCase.execute(id, payload);
  }
  //post - crear
  @Post('crear')
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() payload: dtoCrearAreaInput) {
    return await this.crearAreaUseCase.execute(payload);
  }
}
