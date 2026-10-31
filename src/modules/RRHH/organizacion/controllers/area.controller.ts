//src/modules/RRHH/controller/Area.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus, Param, Patch, Delete, UseGuards, UsePipes, ParseUUIDPipe, Get, Query, Put } from '@nestjs/common';
//Casos de uso para las operaciones de area
import { CrearAreaUseCase } from '../use-cases/area/crearArea.useCase';
import { EditarAreaUseCase } from '../use-cases/area/editarArea.useCase';
import { EstadoAreaUseCase } from '../use-cases/area/estadoArea.useCase';
import { ListarAreasUseCase } from '../use-cases/area/listarAreas.useCase';
//Importar guardias de autenticación y autorización
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
//Importar esquemas y DTOs para validación y tipado
import { CrearAreaSchema, ActualizarAreaSchema, ListarAreasQuerySchema } from '@jyp/shared-contracts';
import type { CrearAreaDto, ActualizarAreaDto, ListarAreasQueryDto } from '@jyp/shared-contracts';
import { ApiSwaggerAreasController, ApiSwaggerCrearArea, ApiSwaggerActualizarArea, ApiSwaggerDesactivarArea, ApiSwaggerReactivarArea, ApiSwaggerListarAreas, ApiDetalleArea } from '../decorators/area-swagger.decorator';


/**
 * Controlador para gestionar las áreas en el módulo de RRHH.
 * @requires - JWT Bearer token para autenticación.
 * @requires - Roles: ADMIN, RRHH para autorización.
 */
@ApiSwaggerAreasController()
@Controller('api/v1/rrhh/area')
@UseGuards(JwtAccessGuard, RolesGuard)
export class AreaController {
  //Inyectar los casos de uso necesarios para manejar las operaciones relacionadas con las areas
  constructor(
    private readonly crearAreaUseCase: CrearAreaUseCase,
    private readonly editarAreaUseCase: EditarAreaUseCase,
    private readonly estadoAreaUseCase: EstadoAreaUseCase,
    private readonly listarAreasUseCase: ListarAreasUseCase
  ) {}

  /**
   * Crear un nuevo area
   * @POST - /api/v1/rrhh/area/crear
   * @param payload : dtoCrearAreaInput{
   *    "nombre" : "Area-prueba-Nro1",
   *    "descripcion" : "Descripcion-Nro1"
   * }
   * @Returns
   */
  @ApiSwaggerCrearArea()
  @Post('crear')
  @Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(CrearAreaSchema))
  async crear(@Body() payload: CrearAreaDto) {
    return await this.crearAreaUseCase.execute(payload);
  }

  /**
   * Actualizar un area existente
   * @Put - /api/v1/rrhh/area/:id
   * @param id_area string - UUID
   * @param payload : dtoActualizarAreaInput{
   *    "nombre" : "Area-Nro1",
   *    "descripcion" : "Descripcion-Nro1"
   * }
   * @returns 200 OK - El area ha sido actualizada exitosamente.
   *          404 Not Found - El area con el ID proporcionado no existe.
   *          400 Bad Request - Los datos proporcionados son inválidos.
   */
  @ApiSwaggerActualizarArea()
  @Put(':id')
  @Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(ActualizarAreaSchema, true))
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() payload: ActualizarAreaDto ) {
    return await this.editarAreaUseCase.execute(id, payload);
  }

  /**
   * Reactivar un area que se encuentra desactivada
   * @PATCH - /api/v1/rrhh/area/:id/reactivar
   * @param id_area - string - uuid
   * @returns: 200 OK - El area ha sido reactivada exitosamente.
   *          404 Not Found - El area con el ID proporcionado no existe.
   *          400 Bad Request - El area ya está activa.
   */
  @ApiSwaggerReactivarArea()
  @Patch(':id/reactivar')
  @Roles('ADMIN', 'RRHH')
  @HttpCode(HttpStatus.OK)
  async reactive(@Param('id', ParseUUIDPipe) id: string) {
    return await this.estadoAreaUseCase.reactivar(id);
  }

  /**
   * Eliminar un area (SOFT DELETE)
   * @DELETE - /api/v1/rrhh/area/:id/desactive
   * @param id_area string - UUID
   * @returns - 200 OK - El area ha sido desactivada exitosamente.
   *        404 Not Found - El area con el ID proporcionado no existe.
   *        400 Bad Request - El area tiene cargos activos asociados y no puede ser desactivada.
   */
  @ApiSwaggerDesactivarArea()
  @Delete(':id/desactivar')
  @Roles('ADMIN', 'RRHH')
  @HttpCode(HttpStatus.OK)
  async eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return await this.estadoAreaUseCase.desactivar(id);
  }

  /**
   * Listar areas con paginación y filtros
   * @GET - /api/v1/rrhh/area
   * @Query queryParams : ListarAreasQueryDto {
   *     "page": 1,
   *     "limit": 10,
   *     "search": "Nombre o descripción parcial",
   *     "activo": "Boolean"
   * }
   * @returns Un objeto con las areas encontradas y metadatos de paginación.
   */
  @ApiSwaggerListarAreas()
  @Get()
  @Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(ListarAreasQuerySchema))
  async listarAreas(@Query() queryParams: ListarAreasQueryDto) {
    return await this.listarAreasUseCase.listar(queryParams);
  }

  /**
   * Obtener detalles de un area por su ID
   * @GET - /api/v1/rrhh/area/:id
   * @param id_area string - UUID
   * @returns Detalles del area solicitado.
   *          404 Not Found - El area con el ID proporcionado no existe.
   */
  @Get(':id')
  @Roles('ADMIN', 'RRHH')
  @ApiDetalleArea()
  async obtenerPorId(@Param('id', ParseUUIDPipe) id: string) {
    return this.listarAreasUseCase.obtenerPorId(id);
  }
}
