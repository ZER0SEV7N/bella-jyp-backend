//src/modules/RRHH/controller/empleado.controller.ts
//Controlador para manejar las operaciones relacionadas con los empleados en el módulo de RRHH
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
  Patch,
  UseGuards,
  UsePipes,
  Get,
  Query,
} from '@nestjs/common';
//validacion de estructura de datos mediate el zod
import {
  CrearEmpleadoSchema,
  ObtenerEmpleadosQuerySchema,
} from '@jyp/shared-contracts';
import type {
  CrearEmpleadoDto,
  EditarEmpleadoDto,
  ObtenerEmpleadosQueryDto,
} from '@jyp/shared-contracts';
//casos de uso
import { CrearEmpleadoUseCase } from '../use-cases/empleado/crearEmpleado.useCase';
import { EditarEmpleadoUseCase } from '../use-cases/empleado/editarEmpleado.useCase';
import { EliminarEmpleadoUseCase } from '../use-cases/empleado/eliminarEmpleado.useCase';
import { ActiveEmpleadoUseCase } from '../use-cases/empleado/activeEmpleado.useCase';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { ObtenerEmpleadosUseCase } from '../use-cases/empleado/obtenerEmpleados.useCase';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('api/rrhh/empleado')
@UseGuards(JwtAccessGuard)
export class EmpleadoController {
  constructor(
    private readonly crearEmpleadoUseCase: CrearEmpleadoUseCase,
    private readonly editarEmpleadoUseCase: EditarEmpleadoUseCase,
    private readonly eliminarEmpleadoUseCase: EliminarEmpleadoUseCase,
    private readonly activeEmpleadoUseCase: ActiveEmpleadoUseCase,
    private readonly obtenerEmpleadosUseCase: ObtenerEmpleadosUseCase,
  ) {}

  /**
   * Crear un nuevo empleado
   * POST - /api/rrhh/empleado/crear
   * @param payload : dtoCreateEmpleado
   * @URL : http://localhost:3000/api/rrhh/empleado/crear
   */
  @Post('crear')
  //@Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(CrearEmpleadoSchema))
  async crear(@Body() payload: CrearEmpleadoDto) {
    return await this.crearEmpleadoUseCase.execute(payload);
  }

  /**
   * Listar colaboradores con paginación y filtros
   * GET - /api/rrhh/empleados
   */
  @Get()
  //@Roles('ADMIN', 'RRHH', 'CONTADOR')
  @UsePipes(new ZodValidationPipe(ObtenerEmpleadosQuerySchema)) // Aplica validación a los Query Params
  async obtenerTodos(@Query() queryParams: ObtenerEmpleadosQueryDto) {
    return await this.obtenerEmpleadosUseCase.execute(queryParams);
  }

  /**
   * Actualizar un empleado existente
   * PATCH - /api/rrhh/empleado/:id/actualizar
   * @param id : string --uuid
   * @param payload : EditarEmpleadoDto{
   *   "nombres" : "Nombres-Nro1",
   */
  @Patch(':id/actualizar')
  @HttpCode(HttpStatus.OK)
  async actualizarEmpleado(
    @Param('id') id: string,
    @Body() payload: EditarEmpleadoDto,
  ) {
    return this.editarEmpleadoUseCase.execute(id, payload);
  }

  /**
   * Eliminar un empleado (SOFT DELETE)
   * DELETE - /api/rrhh/empleado/:id/desactive
   * @param id : string - uuid
   */
  @Delete(':id/desactive')
  @HttpCode(HttpStatus.OK)
  async deletedEmpleado(@Param('id') id: string) {
    return await this.eliminarEmpleadoUseCase.execute(id);
  }

  /**
   * Reactivar un empleado que se encuentra desactivado
   * PATCH - /api/rrhh/empleado/:id/reactive
   * @param id - string - uuid
   */
  @Patch(':id/reactive')
  @HttpCode(HttpStatus.OK)
  async reactive(@Param('id') id: string) {
    return await this.activeEmpleadoUseCase.execute(id);
  }
}
