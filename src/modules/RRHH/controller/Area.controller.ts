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
  UseGuards,
} from '@nestjs/common';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
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
  ActiveAreaUseCase,
} from '../use-cases/area';

@Controller('api/rrhh/area')
@UseGuards(JwtAccessGuard)
export class AreaController {
  //constructor de los casos de uso
  constructor(
    private readonly crearAreaUseCase: CrearAreaUseCase,
    private readonly updateAreaUseCase: UpdateAreaUseCase,
    private readonly eliminarAreaUseCase: EliminarAreaUseCase,
    private readonly activeAreaUseCase: ActiveAreaUseCase,
  ) {}
  //reactive area
  /**
   * @param id - string - uuid
   * @URL : http://localhost:3000/api/rrhh/area/ @Param /reactive
   */
  @Patch(':id/reactive')
  @HttpCode(HttpStatus.OK)
  async reactive(@Param('id') id: string) {
    return await this.activeAreaUseCase.execute(id);
  }

  //delete - softdelete
  /**
   * @param id string - UUID
   * @URL : http://localhost:3000/api/rrhh/area/ @Param /desactive
   */
  @Delete(':id/desactive')
  @HttpCode(HttpStatus.OK)
  async eliminar(@Param('id') id: string) {
    return await this.eliminarAreaUseCase.execute(id);
  }
  //update - total
  /**
   * @param id string - UUID
   * @param payload : dtoActualizarAreaInput{
   * "nombre" : "Area-Nro1",
   * "descripcion" : "Descripcion-Nro1"
   * }
   * @URL : http://localhost:3000/api/rrhh/area/@Param /actualizar
   */
  @Patch(':id/actualizar')
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
   * @param {
   * "nombre" : "Area-prueba-Nro1",
   * "descripcion" : "Descripcion-Nro1"
   * }
   * @URL : http://localhost:3000/api/rrhh/area/crear
   */
  @Post('crear')
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() payload: dtoCrearAreaInput) {
    return await this.crearAreaUseCase.execute(payload);
  }
}
