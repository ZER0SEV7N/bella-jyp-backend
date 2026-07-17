import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
  Patch,
} from '@nestjs/common';
//validacion de estructura de datos mediate el zod
import type { dtoCreateEmpleado, dtoEditEmpleado } from '@jyp/shared-contracts';
//casos de uso
import {
  CrearEmpleadoUseCase,
  DeleteEmpleadoUseCase,
  EditEmpleadoUseCase,
} from '../use-cases/empleado';

@Controller('api/rrhh/empleado')
export class EmpleadoController {
  constructor(
    private readonly crearEmpleadoUseCase: CrearEmpleadoUseCase,
    private readonly editEmpleadoUseCase: EditEmpleadoUseCase,
    private readonly eliminarEmpleadoUseCase: DeleteEmpleadoUseCase,
  ) {}
  //crear empelado
  /**
   * @param id : string --uuid
   * @param payload : dtoCreateEmpleado
   * @URL : http://localhost:3000/api/rrhh/empleado/@param id/ actualizar
   */
  @Patch(':id/actualizar')
  @HttpCode(HttpStatus.OK)
  async actualizarEmpleado(
    @Param('id') id: string,
    @Body() payload: dtoEditEmpleado,
  ) {
    return this.editEmpleadoUseCase.execute(id, payload);
  }
  //crear empelado
  /**
   * @param id : string - uuid
   * @URL : http://localhost:3000/api/rrhh/empleado/@param /desactive
   */
  @Delete(':id/desactive')
  @HttpCode(HttpStatus.OK)
  async deletedEmpleado(@Param('id') id: string) {
    return await this.eliminarEmpleadoUseCase.execute(id);
  }

  //crear empelado
  /**
   * @param payload : dtoCreateEmpleado
   * @URL : http://localhost:3000/api/rrhh/empleado/crear
   */
  @Post('crear')
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() payload: dtoCreateEmpleado) {
    return await this.crearEmpleadoUseCase.execute(payload);
  }
}
