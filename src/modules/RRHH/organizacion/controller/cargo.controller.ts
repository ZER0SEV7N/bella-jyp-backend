//src/modules/RRHH/controller/cargo.controller.ts
//Controlador para manejar las operaciones relacionadas con los cargos en el módulo de RRHH
import { Controller, Post, Body, HttpCode, HttpStatus, Put, Param, Patch, Delete, UseGuards, UsePipes, ParseUUIDPipe, Get, Query} from '@nestjs/common';
//casos de uso
import { CrearCargoUseCase } from '../use-cases/cargos/crearCargo.UseCase';
import { ActualizarCargoUseCase } from '../use-cases/cargos/actualizarCargo.UseCase';
import { EstadoCargoUseCase } from '../use-cases/cargos/estadoCargo.UseCase';
import { ListarCargosUseCase } from '../use-cases/cargos/listarCargos.useCase';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CrearCargoSchema, ActualizarCargoSchema } from '@jyp/shared-contracts';
import type {CrearCargoDto, ActualizarCargoDto, ListarCargosQueryDto} from '@jyp/shared-contracts';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import {
  ApiSwaggerCargosController,
  ApiSwaggerCrearCargo,
  ApiSwaggerActualizarCargo,
  ApiSwaggerDesactivarCargo,
  ApiSwaggerReactivarCargo,
  ApiSwaggerListarCargos,
} from '../decorators/cargo-swagger.decorator';

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
   * POST /api/rrhh/cargo/crear
   * @DTO : {
   *    "id_area" : id string - uuid
   *    "nombre" : "nombre de area"
   *    "descripcion" : "decripcion"
   *    "jornada_sugerida_id" : id string - uuid
   * 
   * }
   * @returns: 201 Created - El cargo ha sido creado exitosamente.
   *          400 Bad Request - Los datos proporcionados son inválidos.
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
   * PUT /api/rrhh/cargo/@param /actualizar
   * @param id string - uuid
   * @DTO : {
   *   "id_area" : id string - uuid
   *   "nombre" : "nombre de area"
   *   "descripcion" : "decripcion"
   *   "jornada_sugerida_id" : id string - uuid
   * }
   * @returns: 200 OK - El cargo ha sido actualizado exitosamente.
   *          404 Not Found - El cargo con el ID proporcionado no existe.
   *          400 Bad Request - Los datos proporcionados son inválidos.
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
   * DELETE /api/rrhh/cargo/@param /desactive
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
   * PATCH /api/rrhh/cargo/@param /reactive
   * @param id string - uuid
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
   * Solamente los usuarios con rol de "ADMIN" o "RRHH" pueden listar los cargos.
   * GET - /api/rrhh/cargo
   * @Query queryParams : ListarCargosQueryDto {
   *   "page": 1,
   *   "limit": 10,
   *   "activo": "Boolean",
   *   "id_area": "uuid",
   *   "jornada_sugerida_id": "uuid"
   * }
   * @returns Un objeto con los cargos encontrados y metadatos de paginación.
   */
  @ApiSwaggerListarCargos()
  @Get()
  @Roles('ADMIN', 'RRHH')
  async listarCargos(@Query() queryParams: ListarCargosQueryDto) {
    return await this.listarCargosUseCase.listar(queryParams);
  }
}
