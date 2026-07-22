//src/modules/RRHH/controller/empleado.controller.ts
//Controlador para manejar las operaciones relacionadas con los empleados en el módulo de RRHH
import { Controller, Post, Body, HttpCode, HttpStatus, Delete, Param ,Patch, UseGuards } from '@nestjs/common';
//validacion de estructura de datos mediate el zod
import type { dtoCreateEmpleado, dtoEditEmpleado } from '@jyp/shared-contracts';
//casos de uso
import { CrearEmpleadoUseCase } from '../use-cases/empleado/crearEmpleado.useCase'
import { EditarEmpleadoUseCase } from '../use-cases/empleado/editarEmpleado.useCase';
import { EliminarEmpleadoUseCase } from '../use-cases/empleado/eliminarEmpleado.useCase';
import { ActiveEmpleadoUseCase } from '../use-cases/empleado/activeEmpleado.useCase';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';

@Controller('api/rrhh/empleado')
export class EmpleadoController {
  constructor(
    private readonly crearEmpleadoUseCase: CrearEmpleadoUseCase,
    private readonly editEmpleadoUseCase: EditarEmpleadoUseCase,
    private readonly eliminarEmpleadoUseCase: EliminarEmpleadoUseCase,
    private readonly activeEmpleadoUseCase: ActiveEmpleadoUseCase,
  ) {}


  /**
   * Actualizar un empleado existente
   * PATCH - /api/rrhh/empleado/:id/actualizar
   * @param id : string --uuid
   * @param payload : dtoEditEmpleado{
   *   "nombres" : "Nombres-Nro1", 
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
  //reactive empleado
  /**
   * @param id - string - uuid
   * @URL : http://localhost:3000/api/rrhh/empleado/ @Param /reactive
   */
  @Patch(':id/reactive')
  @HttpCode(HttpStatus.OK)
  async reactive(@Param('id') id: string) {
    return await this.activeEmpleadoUseCase.execute(id);
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
