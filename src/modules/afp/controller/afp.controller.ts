//src/modules/afp/controller/afp.controller.ts
//Importaciones de NestJS y commons:
import { Controller, Post, Get, Body, Query, UseGuards, UsePipes } from '@nestjs/common';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
//Casos de uso de escritura de AFP:
import { AgregarAportacionUseCase } from '../use-cases/aportacion/agregarAportacion.useCase';
import { AgregarComisionUseCase } from '../use-cases/comision/agregarComision.useCase';
import { AgregarTipoAfpUseCase } from '../use-cases/tipo-afp/agregarTipoAfp.useCase';
//Casos de uso de lectura de AFP:
import { ListarAportacionesUseCase } from '../use-cases/aportacion/listarAportacion.useCase';
import { ListarComisionesUseCase } from '../use-cases/comision/listarComision.useCase';
import { ListarTiposAfpUseCase } from '../use-cases/tipo-afp/listarTipoAfp.useCase';
//Schemas y DTOs:
import { CrearTipoAfpSchema, CrearComisionSchema, CrearAportacionSchema, ListarTiposAfpQuerySchema, ListarComisionesQuerySchema, ListarAportacionesQuerySchema } from '@jyp/shared-contracts';
import type { CrearTipoAfpDto, CrearComisionDto, AportacionDto, ListarTiposAfpQueryDto, ListarComisionesQueryDto, ListarAportacionesQueryDto } from '@jyp/shared-contracts';
//Swagger decorators:
import { ApiSwaggerAfpController, ApiSwaggerAportacionCrear, ApiSwaggerAportacionListar, ApiSwaggerComisionCrear, ApiSwaggerComisionListar, ApiSwaggerTipoAfpCrear, ApiSwaggerTipoAfpListar } from '../decorators/afp-swagger.decorator';
/**
 * Controlador de AFP.
 * Este controlador maneja las operaciones relacionadas con las AFP, incluyendo la creación de aportaciones, comisiones y tipos de AFP.
 */
@ApiSwaggerAfpController()
@Controller('api/afp')
@UseGuards(JwtAccessGuard, RolesGuard)
export class afpController {
  constructor(
    //aportaciones
    private readonly agregarAportaciones: AgregarAportacionUseCase,
    private readonly listarAportaciones: ListarAportacionesUseCase,
    //comisiones
    private readonly agregarComisiones: AgregarComisionUseCase,
    private readonly listarComisiones: ListarComisionesUseCase,
    //tipoAfp
    private readonly agregarTipoAfp: AgregarTipoAfpUseCase,
    private readonly listarTiposAfp: ListarTiposAfpUseCase
  ) {}

  //======================================================
  //Aportaciones
  //======================================================

  /**
   * Agrega una nueva aportación de AFP.
   * POST /api/afp/aportaciones
   * Este endpoint permite crear una nueva aportación de AFP en el sistema.
   * Se requiere que el usuario tenga los roles 'ADMIN' o 'CONTADOR' para poder realizar esta operación.
   * @param dto - Objeto de transferencia de datos que contiene la información de la nueva aportación a crear.
   * @DTO : {
   *    "nombre": "Aportación 1",
   *    "afp_id": "uuid-de-la-afp",
   *    "cantidad": 100.00,
   * }
   * @returns La aportación de AFP creada.
   */
  @ApiSwaggerAportacionCrear()
  @Post('aportaciones')
  @Roles('ADMIN', 'CONTADOR')
  @UsePipes(new ZodValidationPipe(CrearAportacionSchema))
  async agregarAportacion(@Body() dto: AportacionDto) {
    return await this.agregarAportaciones.execute(dto);
  }

  /**
   * Lista las aportaciones de AFP.
   * GET /api/afp/aportaciones
   * Este endpoint permite obtener una lista de aportaciones de AFP desde la base de datos, con soporte para paginación y filtrado.
   * Se requiere que el usuario tenga los roles 'ADMIN', 'CONTADOR', 'ASISTENTE' o 'RRHH' para poder realizar esta operación.
   * @query - Objeto de transferencia de datos que contiene los parámetros de paginación y filtrado.
   * @Params : {
   *  "page": 1,
   *  "limit": 10,
   *  "afp_id": "uuid-de-la-afp"
   * }
   * @returns Una lista de aportaciones de AFP que cumplen con los criterios especificados en el objeto de consulta.
   */
  @ApiSwaggerAportacionListar()
  @Get('aportaciones')
  @Roles('ADMIN', 'CONTADOR', 'ASISTENTE', 'RRHH')
  @UsePipes(new ZodValidationPipe(ListarAportacionesQuerySchema))
  async listarAportacion(@Query() query: ListarAportacionesQueryDto) {
    return await this.listarAportaciones.listar(query);
  }

  //====================================================
  //COMISIONES (Tasas SBS vigentes por período)
  //====================================================

  /**
   * Agrega una nueva comisión de AFP.
   * POST /api/afp/comisiones
   * Este endpoint permite crear una nueva comisión de AFP en el sistema.
   * Se requiere que el usuario tenga los roles 'ADMIN' o 'CONTADOR' para poder realizar esta operación.
   * @param dto - Objeto de transferencia de datos que contiene la información de la nueva comisión a crear.
   * @DTO : {
   *    "tipo_afp_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
   *    "anterior_comision": {
   *        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
   *        "periodo_final": "2026-07-31"
   *    },
   *    "nueva_comision": {
   *        "periodo_inicio": "2026-08-01",
   *        "aporte_obligatorio": 10,
   *        "comision_sobre_ra": 1.55,
   *        "prima_seguro": 1.84,
   *        "comision_mixta": 0.78
   *    }
   * }
   */
  @ApiSwaggerComisionCrear()
  @Post('comisiones')
  @Roles('ADMIN', 'CONTADOR')
  @UsePipes(new ZodValidationPipe(CrearComisionSchema))
  async agregarComision(@Body() dto: CrearComisionDto) {
    return await this.agregarComisiones.execute(dto);
  }

  /**
   * Lista las comisiones de AFP.
   * GET /api/afp/comisiones
   * Este endpoint permite obtener una lista de comisiones de AFP desde la base de datos, con soporte para paginación y filtrado.
   * Se requiere que el usuario tenga los roles 'ADMIN', 'CONTADOR', 'ASISTENTE' o 'RRHH' para poder realizar esta operación.
   * @query - Objeto de transferencia de datos que contiene los parámetros de paginación y filtrado.
   * @Params : {
   * "page": 1,
   * "limit": 10,
   * "afp_id": "uuid-de-la-afp",
   * "solo_vigentes": true
   * }
   * @returns Una lista de comisiones de AFP que cumplen con los criterios especificados en el objeto de consulta.
   */
  @ApiSwaggerComisionListar()
  @Get('comisiones')
  @Roles('ADMIN', 'CONTADOR', 'ASISTENTE', 'RRHH')
  @UsePipes(new ZodValidationPipe(ListarComisionesQuerySchema))
  async listarComision(@Query() query: ListarComisionesQueryDto) {
    return await this.listarComisiones.listar(query);
  }

  //====================================================
  //TIPO AFP (Integra, Prima, Habitat, Profuturo)
  //====================================================

  /**
   * Asigna un nuevo tipo de AFP.
   * POST /api/afp/tipos
   * Este endpoint permite crear un nuevo tipo de AFP en el sistema. 
   * Se requiere que el usuario tenga los roles 'ADMIN' o 'CONTADOR' para poder realizar esta operación.
   * @param dto - Objeto de transferencia de datos que contiene la información del nuevo tipo de AFP a crear.
   * @DTO : {
   *    "nombre": "Integra",
   *    "id_regimen": "uuid-del-regimen"
   * }
   * @returns El tipo de AFP creado.
   */
  @ApiSwaggerTipoAfpCrear()
  @Post('tipos')
  @Roles('ADMIN', 'CONTADOR')
  @UsePipes(new ZodValidationPipe(CrearTipoAfpSchema))
  async asignarTipoAfp(@Body() dto: CrearTipoAfpDto) {
    return await this.agregarTipoAfp.execute(dto);
  }

  /**
   * Lista los tipos de AFP.
   * GET /api/afp/tipos
   * Este endpoint permite obtener una lista de tipos de AFP desde la base de datos, con soporte para paginación y filtrado.
   * Se requiere que el usuario tenga los roles 'ADMIN', 'CONTADOR', 'ASISTENTE' o 'RRHH' para poder realizar esta operación.
   * @query - Objeto de transferencia de datos que contiene los parámetros de paginación y filtrado.
   * @Params : {
   *   "page": 1,
   *  "limit": 10
   * }
   * @returns Una lista de tipos de AFP que cumplen con los criterios especificados en el objeto de consulta.
   */
  @ApiSwaggerTipoAfpListar()
  @Get('tipos')
  @Roles('ADMIN', 'CONTADOR', 'ASISTENTE', 'RRHH')
  @UsePipes(new ZodValidationPipe(ListarTiposAfpQuerySchema))
  async listarAfp(@Query() query: ListarTiposAfpQueryDto) {
    return await this.listarTiposAfp.listar(query);
  }
}
