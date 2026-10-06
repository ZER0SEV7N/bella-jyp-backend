//src/modules/RRHH/controller/empleado.controller.ts
//Controlador para manejar las operaciones relacionadas con los empleados en el módulo de RRHH
import { Controller, Post, Body, HttpCode, HttpStatus, Delete, Param, Patch, UseGuards, UsePipes, Get,  Query, ParseUUIDPipe } from '@nestjs/common';
//validacion de estructura de datos mediate el zod
import { CrearEmpleadoSchema, EditarEmpleadoSchema, ListarEmpleadosQuerySchema, DesactivarEmpleadoSchema, CambiarEstadoLaboralSchema } from '@jyp/shared-contracts';
import type { CrearEmpleadoDto, EditarEmpleadoDto, ListarEmpleadosQueryDto, DesactivarEmpleadoDto, CambiarEstadoLaboralDto } from '@jyp/shared-contracts';
//casos de uso
import { CrearEmpleadoUseCase } from '../use-cases/empleado/crearEmpleado.useCase';
import { EditarEmpleadoUseCase } from '../use-cases/empleado/editarEmpleado.useCase';
import { EstadoEmpleadoUseCase } from '../use-cases/empleado/estadoEmpleado.useCase';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ListarEmpleadosUseCase } from '../use-cases/empleado/listarEmpleados.useCase';
import { Roles } from '@/common/decorators/roles.decorator';
import { ApiSwaggerEmpleadosController, ApiSwaggerCrearEmpleado, ApiSwaggerActualizarEmpleado, ApiSwaggerDesactivarEmpleado, ApiSwaggerReactivarEmpleado, ApiSwaggerListarEmpleados } from '../decorators/empleado-swagger.decorator';

/**
 * Controlador para manejar las operaciones relacionadas con los empleados en el módulo de RRHH.
 * Este controlador expone endpoints para crear, actualizar, listar, desactivar y reactivar empleados.
 * Se aplican guardias de autenticación y autorización para proteger los endpoints según los roles definidos.
 * Endpoints disponibles:
 * - POST /api/rrhh/empleado/crear: Crear un nuevo empleado.
 * - PATCH /api/rrhh/empleado/:id/actualizar: Actualizar un empleado existente.
 * - GET /api/rrhh/empleado: Listar empleados con paginación y filtros.
 * - DELETE /api/rrhh/empleado/:id/desactivar: Desactivar un empleado (soft delete).
 * - PATCH /api/rrhh/empleado/:id/reactivar: Reactivar un empleado previamente desactivado.
 */
@ApiSwaggerEmpleadosController()
@Controller('api/rrhh/empleado')
@UseGuards(JwtAccessGuard, RolesGuard)
export class EmpleadoController {
  constructor(
    private readonly crearEmpleadoUseCase: CrearEmpleadoUseCase,
    private readonly editarEmpleadoUseCase: EditarEmpleadoUseCase,
    private readonly estadoEmpleadoUseCase: EstadoEmpleadoUseCase,
    private readonly listarEmpleadosUseCase: ListarEmpleadosUseCase,
  ) {}

  /**
   * Crear un nuevo empleado
   * POST - /api/rrhh/empleado/crear
   * @param payload : CrearEmpleadoDto {
   *                     "cargo_id": "uuid",
   *                     "area_id": "uuid",
   *                     "documento_id": "uuid",
   *                     "estado_empleado_id": "uuid",
   *                     "nro_documento": "string",
   *                     "nombre": "string",
   *                     "apellido": "string",
   *                     "fecha_nacimiento": "date (ISO 8601)",
   *                     "fecha_inicio": "date (ISO 8601)",
   *                     "asig_familiar": "Boolean"
   *                  }
   * @returns 201 Created - El empleado ha sido creado exitosamente.
   *          400 Bad Request - Los datos proporcionados son inválidos.
   *          401 Unauthorized - El usuario no tiene un token válido.
   *          403 Forbidden - El usuario no tiene los permisos necesarios.
   */
  @ApiSwaggerCrearEmpleado()
  @Post('crear')
  @Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(CrearEmpleadoSchema))
  async crear(@Body() payload: CrearEmpleadoDto) {
    return await this.crearEmpleadoUseCase.execute(payload);
  }

  /**
   * Listar colaboradores con paginación y filtros
   * GET - /api/rrhh/empleados
   * @Query queryParams : ListarEmpleadosQueryDto {
   *    "page": 1,
   *    "limit": 10,
   *    "area_id": "uuid",
   *    "cargo_id": "uuid",
   *    "activo": "Boolean",
   *    "nro_documento": "string",
   *    "search": "string"
   * }
   */
  @ApiSwaggerListarEmpleados()
  @Get()
  @Roles('ADMIN', 'RRHH', 'CONTADOR')
  @UsePipes(new ZodValidationPipe(ListarEmpleadosQuerySchema)) // Aplica validación a los Query Params
  async obtenerTodos(@Query() queryParams: ListarEmpleadosQueryDto) {
    return await this.listarEmpleadosUseCase.execute(queryParams);
  }

  /**
   * Actualizar un empleado existente
   * PATCH - /api/rrhh/empleado/:id/actualizar
   * @param id : string --uuid
   * @param payload : EditarEmpleadoDto{
   *   "nombres" : "Nombres-Nro1",
   */
  @ApiSwaggerActualizarEmpleado()
  @Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(EditarEmpleadoSchema))
  @Patch(':id/actualizar')
  @HttpCode(HttpStatus.OK)
  async actualizarEmpleado( @Param('id') id: string, @Body() payload: EditarEmpleadoDto ) {
    return this.editarEmpleadoUseCase.execute(id, payload);
  }

  /**
   * Eliminar un empleado (SOFT DELETE)
   * DELETE - /api/rrhh/empleado/:id/desactivar
   * @param id : string - uuid
   */
  @ApiSwaggerDesactivarEmpleado()
  @Delete(':id/desactivar')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'RRHH')
  async desactivar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(DesactivarEmpleadoSchema.optional())) dto?: DesactivarEmpleadoDto) {
    return await this.estadoEmpleadoUseCase.desactivar(id);
  }

  /**
   * Reactivar un empleado que se encuentra desactivado
   * PATCH - /api/rrhh/empleado/:id/reactivar
   * @param id - string - uuid
   */
  @ApiSwaggerReactivarEmpleado()
  @Patch(':id/reactivar')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'RRHH')
  async reactivar(@Param('id') id: string) {
    return await this.estadoEmpleadoUseCase.reactivar(id);
  }

  /**
   * Cambiar el estado laboral de un empleados ACTIVOS
   * Los estados laborales permitidos son: ACTIVO, SUSPENDIDO, VACACIONES, LICENCIA
   * PATCH - /api/rrhh/empleado/:id/estado-laboral
   * @param id - UUID del empleado cuyo estado laboral se desea cambiar.
   * @param dto - CambiarEstadoLaboralDto que contiene el nuevo estado laboral y un motivo opcional.
   * @DTO : CambiarEstadoLaboralDto {
   *     - "estado_laboral": 'ACTIVO' | 'VACACIONES' | 'LICENCIA' | 'SUSPENDIDO',
   *     - "motivo": string (opcional, máximo 255 caracteres)
   *     }
   * @returns - Un objeto con el estado de la operación, un mensaje y los datos del empleado con el nuevo estado laboral.
   * @throws NotFoundException - Si el empleado no existe o no está activo.
   * @throws BadRequestException - Si el nuevo estado laboral es el mismo que el actual.
   */
  @Patch(':id/estado-laboral')
  @Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(CambiarEstadoLaboralSchema))
  async cambiarEstadoLaboral(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CambiarEstadoLaboralDto) {
    return await this.estadoEmpleadoUseCase.cambiarEstadoLaboral(id, dto);
  }
}
