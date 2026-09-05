//src/modules/RRHH/controller/cargo.controller.ts
//Controlador para manejar las operaciones relacionadas con los cargos en el módulo de RRHH
import { Controller, Post, Body, HttpCode, HttpStatus, Put, Param, Patch, Delete, UseGuards, UsePipes, ParseUUIDPipe, Get, Query} from '@nestjs/common';
//casos de uso
import { CrearCargoUseCase } from '../use-cases/cargos/crearCargo.useCase';
import { ActualizarCargoUseCase } from '../use-cases/cargos/actualizarCargo.useCase';
import { EstadoCargoUseCase } from '../use-cases/cargos/estadoCargo.useCase';
import { ListarCargosUseCase } from '../use-cases/cargos/listarCargos.useCase';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
//Importar esquemas y DTOs para validación y tipado
import { CrearCargoSchema, ActualizarCargoSchema } from '@jyp/shared-contracts';
import type {CrearCargoDto, ActualizarCargoDto, ListarCargosQueryDto} from '@jyp/shared-contracts';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
//Importar decoradores de Swagger para documentación de la API
import { ApiSwaggerCargosController, ApiSwaggerCrearCargo, ApiSwaggerActualizarCargo, ApiSwaggerDesactivarCargo, ApiSwaggerReactivarCargo, ApiSwaggerListarCargos } from '../decorators/cargo-swagger.decorator';

/**
 * Controlador para gestionar los cargos en el módulo de RRHH.
 * @requires - JWT Bearer token para autenticación.
 * @requires - Roles: ADMIN, RRHH para autorización.
 */
@ApiSwaggerCargosController()
@Controller('api/rrhh/cargo')
@UseGuards(JwtAccessGuard, RolesGuard)
export class CargoController {
  constructor(
    private readonly crearCargoUseCase: CrearCargoUseCase,
    private readonly actualizarCargoUseCase: ActualizarCargoUseCase,
    private readonly estadoCargoUseCase: EstadoCargoUseCase,
    private readonly listarCargosUseCase: ListarCargosUseCase,
  ) {}

  /**
   * Crear un nuevo cargo
   * Solamente los usuarios con rol de "ADMIN" o "RRHH" pueden crear un nuevo cargo.
   * @POST /api/rrhh/cargo/crear
   * @DTO : {
   *    "id_area": string (UUID válido),
   *    "nombre": string (2-100 carácteres),
   *    "descripcion"?: string | null (máx 255 carácteres),
   *    "sueldo_minimo"?: number (mínimo referencial/base, default 1130.00),
   *    "sueldo_maximo"?: number | null (tope de banda salarial)
   * }
   * @returns: 201 Created - El cargo ha sido creado exitosamente.
   *           400 Bad Request - Datos inválidos, nombre duplicado en el área o banda salarial inconsistente.
   *           404 Not Found - El área especificada no existe o está inactiva.
   */
  @ApiSwaggerCrearCargo()
  @Post('crear')
  @UsePipes(new ZodValidationPipe(CrearCargoSchema))
  @Roles('ADMIN', 'RRHH')
  async crear(@Body() payload: CrearCargoDto) {
    return await this.crearCargoUseCase.execute(payload);
  }

  /**
   * Editar un cargo existente
   * Solamente los usuarios con rol de "ADMIN" o "RRHH" pueden editar un cargo existente.
   * @PUT /api/rrhh/cargo/:id/actualizar
   * @param id - string (UUID)
   * @DTO : {
   *    "id_area"?: string (UUID válido),
   *    "nombre"?: string (2-100 carácteres),
   *    "descripcion"?: string | null,
   *    "sueldo_minimo"?: number | null,
   *    "sueldo_maximo"?: number | null
   * }
   * @returns: 200 OK - El cargo ha sido actualizado exitosamente.
   *           404 Not Found - El cargo con el ID proporcionado no existe o fue eliminado.
   *           400 Bad Request - Datos inválidos, nombre duplicado en el área destino o banda salarial inconsistente.
   */
  @ApiSwaggerActualizarCargo()
  @Put(':id/actualizar')
  @UsePipes(new ZodValidationPipe(ActualizarCargoSchema))
  @Roles('ADMIN', 'RRHH')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() payload: ActualizarCargoDto) {
    return await this.actualizarCargoUseCase.execute(id, payload);
  }

  /**
   * Eliminar un cargo (SOFT DELETE)
   * Solamente los usuarios con rol de "ADMIN" o "RRHH" pueden eliminar un cargo.
   * @DELETE /api/rrhh/cargo/@param /desactive
   * @param id string - uuid
   */
  @ApiSwaggerDesactivarCargo()
  @Delete(':id/desactive')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'RRHH')
  async eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return await this.estadoCargoUseCase.desactivar(id);
  }

  /**
   * Reactivar un cargo que se encuentra desactivado
   * Solamente los usuarios con rol de "ADMIN" o "RRHH" pueden reactivar un cargo desactivado.
   * Valida que el área a la que pertenece se encuentre activa.
   * @PATCH /api/rrhh/cargo/:id/reactive
   * @param id - string (UUID)
   */
  @ApiSwaggerReactivarCargo()
  @Patch(':id/reactive')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'RRHH')
  async reactive(@Param('id', ParseUUIDPipe) id: string) {
    return await this.estadoCargoUseCase.reactivar(id);
  }

  /**
   * Listar cargos con paginación y filtros
   * Permite listar cargos con soporte de búsqueda global y filtros por área o estado.
   * @GET /api/rrhh/cargo
   * @Query queryParams : ListarCargosQueryDto {
   *    "page"?: number (default 1),
   *    "limit"?: number (default 10, max 100),
   *    "search"?: string (búsqueda por nombre o descripción),
   *    "id_area"?: string (UUID del área),
   *    "activo"?: boolean
   * }
   * @returns Un objeto con los cargos encontrados, su área, bandas salariales y metadatos de paginación.
   */
  @ApiSwaggerListarCargos()
  @Get()
  @Roles('ADMIN', 'RRHH')
  async listarCargos(@Query() queryParams: ListarCargosQueryDto) {
    return await this.listarCargosUseCase.listar(queryParams);
  }
}
