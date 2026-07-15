import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
//validacion de estructura de datos mediate el zod
import type { dtoCreateEmpleado } from '@jyp/shared-contracts';
//casos de uso
import { CrearEmpleadoUseCase } from '../use-cases/empleado';

@Controller('api/rrhh/empleado')
export class EmpleadoController {
  constructor(private readonly crearEmpleadoUseCase: CrearEmpleadoUseCase) {}
  @Post('crear')
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() payload: dtoCreateEmpleado) {
    return await this.crearEmpleadoUseCase.execute(payload);
  }
}
