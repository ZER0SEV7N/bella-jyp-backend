//src/modules/afp/controller/afp.controller.ts
//Importaciones de NestJS y commons:
import { Controller, Post, Get, Body, Query, UseGuards, UsePipes } from '@nestjs/common';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
//Casos de uso de escritura de AFP:
import { AgregarComisionUseCase } from '../use-cases/comision/agregarComision.useCase';
import { AgregarTipoAfpUseCase } from '../use-cases/tipo-afp/agregarTipoAfp.useCase';
//Casos de uso de lectura de AFP:
import { ListarComisionesUseCase } from '../use-cases/comision/listarComision.useCase';
import { ListarTiposAfpUseCase } from '../use-cases/tipo-afp/listarTipoAfp.useCase';
//Schemas y DTOs:
import { CrearTipoAfpSchema, CrearComisionSchema, ListarTiposAfpQuerySchema, ListarComisionesQuerySchema } from '@jyp/shared-contracts';
import type { CrearTipoAfpDto, CrearComisionDto,  ListarTiposAfpQueryDto, ListarComisionesQueryDto } from '@jyp/shared-contracts';
//Swagger decorators:
import { ApiSwaggerAfpController, ApiSwaggerComisionCrear, ApiSwaggerComisionListar, ApiSwaggerTipoAfpCrear, ApiSwaggerTipoAfpListar } from '../decorators/afp-swagger.decorator';

/**
 * Controlador principal del módulo de AFP y Pensiones.
 * Este controlador maneja todos los endpoints HTTP relacionados con comisiones y tipos de AFP.
 * Se requiere autenticación JWT y roles específicos para acceder a los endpoints.
 * Endpoints:
 * - POST /api/afp/comisiones: Agrega una nueva comisión de AFP.
 * - GET /api/afp/comisiones: Lista las comisiones de AFP con soporte para paginación y filtrado.
 * - POST /api/afp/tipos: Asigna un nuevo tipo de AFP.
 * - GET /api/afp/tipos: Lista los tipos de AFP con soporte para paginación y filtrado.
 */
@ApiSwaggerAfpController()
@Controller('api/afp')
@UseGuards(JwtAccessGuard, RolesGuard)
export class AfpController {
  constructor(
    //comisiones
    private readonly agregarComisiones: AgregarComisionUseCase,
    private readonly listarComisiones: ListarComisionesUseCase,
    //tipoAfp
    private readonly agregarTipoAfp: AgregarTipoAfpUseCase,
    private readonly listarTiposAfp: ListarTiposAfpUseCase,
  ) {}

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
   *    "tipo_afp_id": "uuid-de-la-afp",
   *    "anterior_comision": {
   *        "id": "uuid-de-la-comision-anterior",
   *        "periodo_final": "2024-12-31"
   *    },
   *    "nueva_comision": {
   *        "periodo_inicio": "2025-01-01",
   *        "aporte_obligatorio": 10,
   *        "comision_sobre_ra": 1.55,
   *        "prima_seguro": 1.84,
   *        "comision_mixta": 0.78
   *    }
   * }
   * 
   */
  @ApiSwaggerComisionCrear()
  @Post('comisiones')
  @Roles('JYP')
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
  @Roles('JYP')
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
