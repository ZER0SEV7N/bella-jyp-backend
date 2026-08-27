//src/modules/jornada/use-cases/estadoJornada.useCase.ts
import { Controller, Post, Param, Body, Get, Query, UseGuards, UsePipes, ParseUUIDPipe, HttpCode, Put, Delete, HttpStatus, Patch } from '@nestjs/common';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
//Casos de uso
import { EstadoJornadaUseCase } from '../use-cases/jornadas/estadoJornada.useCase';
import { CrearJornadaUseCase } from '../use-cases/jornadas/crearJornada.useCase';
import { EditarJornadaUseCase } from '../use-cases/jornadas/editarJornada.useCase';
import { ListarJornadaUseCase } from '../use-cases/jornadas/listarJornada.useCase';
//DTOs y esquemas de validación
import type {CrearJornadaDto, ActualizarJornadaDto,ListarJornadasQueryDto } from '@jyp/shared-contracts';
import { CrearJornadaSchema, ActualizarJornadaSchema, ListarJornadasQuerySchema } from '@jyp/shared-contracts';
import {
  ApiSwaggerJordanaController,
  ApiSwaggerCrearJordana,
  ApiSwaggerListarJordana,
  ApiSwaggerActualizarJordana,
  ApiSwaggerDesactivarJordana,
  ApiSwaggerReactivarJordana
} from '../decorators/jordana-swagger.decorator';

/**
 * Controlador para gestionar las jornadas laborales en el módulo de RRHH.
 * @requires - JWT Bearer token para autenticación.
 * @requires - Roles: ADMIN, RRHH para autorización.
 */
@ApiSwaggerJordanaController()
@Controller('api/rrhh/jornadas')
@UseGuards(JwtAccessGuard, RolesGuard)
export class JornadaController {
  constructor(
    private readonly estadoJornadaUseCase: EstadoJornadaUseCase,
    private readonly crearJornadaUseCase: CrearJornadaUseCase,
    private readonly editarJornadaUseCase: EditarJornadaUseCase,
    private readonly listarJornadaUseCase: ListarJornadaUseCase,
  ) {}

  /**
   * Crear una nueva jornada laboral
   * Permite crear una nueva jornada laboral en el sistema. Se requiere que el usuario tenga el rol de "ADMIN" o "RRHH" para realizar esta acción.
   * POST /api/rrhh/jornadas
   * @param dto - Datos de la nueva jornada laboral a crear, validados mediante el esquema CrearJornadaSchema.
   * @DTO { nombre: string,
   *        tipo_jornada: string (FIJA | ROTATIVA | FLEXIBLE | PART_TIME),
   *        hora_entrada: string (ISO DateTime),
   *        hora_salida: string (ISO DateTime),
   *        activo: boolean,
   *        tolerancia_minutos: number
   *     }
   * @returns La jornada laboral creada con sus detalles.
   * @throws {BadRequestException}
   */
  @ApiSwaggerCrearJordana()
  @Post()
  @Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(CrearJornadaSchema))
  async crearJornada(@Body() dto: CrearJornadaDto) {
    return await this.crearJornadaUseCase.execute(dto);
  }

  /**
   * Listar jornadas laborales
   * Permite obtener un listado de jornadas laborales con paginación y filtrado opcional por estado (activo/inactivo).
   * GET /api/rrhh/jornadas
   * @Query { page: number,
   *          limit: number,
   *          activo: boolean 
   *          tipo_jornada: string (FIJA | ROTATIVA | FLEXIBLE | PART_TIME)
   *        }
   * @returns Un objeto con las jornadas laborales encontradas y metadatos de paginación.
   */
  @ApiSwaggerListarJordana()
  @Get()
  @Roles('ADMIN', 'RRHH', 'CONTADOR')
  @UsePipes(new ZodValidationPipe(ListarJornadasQuerySchema))
  async listarJornadas(@Query() query: ListarJornadasQueryDto) {
    return await this.listarJornadaUseCase.execute(query);
  }

  /**
   * Actualizar una jornada laboral
   * Permite actualizar los detalles de una jornada laboral existente. Se requiere que el usuario tenga el rol de "ADMIN" o "RRHH" para realizar esta acción.
   * PUT /api/rrhh/jornadas/:id
   * @param id - ID de la jornada laboral a actualizar (UUID).
   * @param dto - Datos actualizados de la jornada laboral, validados mediante el esquema ActualizarJornadaSchema.
   * @DTO { nombre?: string,
   *       tipo_jornada?: string (FIJA | ROTATIVA | FLEXIBLE | PART_TIME),
   *       hora_entrada?: string (ISO DateTime),
   *       hora_salida?: string (ISO DateTime),
   *       activo?: boolean,
   *       tolerancia_minutos?: number
   * }
   * @returns La jornada laboral actualizada con sus detalles.
   * @throws {NotFoundException, BadRequestException}
   */
  @ApiSwaggerActualizarJordana()
  @Put('/:id')
  @Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(ActualizarJornadaSchema))
  async actualizarJornada(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarJornadaDto,
  ) {
    return await this.editarJornadaUseCase.execute(id, dto);
  }

  /**
   * Desactivar una jornada laboral
   * Permite desactivar una jornada laboral existente. Se requiere que el usuario tenga el rol de "ADMIN" o "RRHH" para realizar esta acción.
   * DELETE /api/rrhh/jornadas/:id/desactivar
   * @param id - ID de la jornada laboral a desactivar (UUID).
   * @returns La jornada laboral desactivada con sus detalles.
   * @throws {NotFoundException, BadRequestException}
   */
  @ApiSwaggerDesactivarJordana()
  @Delete('/:id/desactivar')
  @Roles('ADMIN', 'RRHH')
  @HttpCode(HttpStatus.OK)
  async desactivarJornada(@Param('id', ParseUUIDPipe) id: string) {
    return await this.estadoJornadaUseCase.desactivar(id);
  }

  /**
   * Reactivar una jornada laboral
   * Permite reactivar una jornada laboral desactivada. Se requiere que el usuario tenga el rol de "ADMIN" o "RRHH" para realizar esta acción.
   * PATCH /api/rrhh/jornadas/:id/reactivar
   * @param id - ID de la jornada laboral a reactivar (UUID).
   * @returns La jornada laboral reactivada con sus detalles.
   * @throws {NotFoundException}
   */
  @ApiSwaggerReactivarJordana()
  @Patch('/:id/reactivar')
  @Roles('ADMIN', 'RRHH')
  @HttpCode(HttpStatus.OK)
  async reactivarJornada(@Param('id', ParseUUIDPipe) id: string) {
    return await this.estadoJornadaUseCase.reactivar(id);
  }
}
