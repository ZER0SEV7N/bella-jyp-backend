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
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
//validacion de estructura de datos mediate el zod
import {
  CrearEmpleadoSchema,
  EditarEmpleadoSchema,
  ListarEmpleadosQuerySchema,
  DesactivarEmpleadoSchema,
  CambiarEstadoLaboralSchema,
} from '@jyp/shared-contracts';
import type {
  CrearEmpleadoDto,
  EditarEmpleadoDto,
  ListarEmpleadosQueryDto,
  DesactivarEmpleadoDto,
  CambiarEstadoLaboralDto,
} from '@jyp/shared-contracts';
//casos de uso
import { CrearEmpleadoUseCase } from '../use-cases/empleado/crearEmpleado.useCase';
import { EditarEmpleadoUseCase } from '../use-cases/empleado/editarEmpleado.useCase';
import { EstadoEmpleadoUseCase } from '../use-cases/empleado/estadoEmpleado.useCase';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ListarEmpleadosUseCase } from '../use-cases/empleado/listarEmpleados.useCase';
import { Roles } from '@/common/decorators/roles.decorator';
import {
  ApiSwaggerEmpleadosController,
  ApiSwaggerCrearEmpleado,
  ApiSwaggerActualizarEmpleado,
  ApiSwaggerDesactivarEmpleado,
  ApiSwaggerReactivarEmpleado,
  ApiSwaggerListarEmpleados,
  ApiDetalleEmpleado,
  ApiSwaggerCambiarEstadoLaboral,
} from '../decorators/empleado-swagger.decorator';

/**
 * Controlador para manejar las operaciones relacionadas con los empleados en el módulo de RRHH.
 * Se aplican guards de autenticación (JwtAccessGuard) y autorización por roles (RolesGuard).
 * Endpoints disponibles:
 * - POST   /api/v1/rrhh/empleado                                   : Registrar un empleado completo (legajo, datos financieros y derechohabientes).
 * - GET    /api/v1/rrhh/empleado                                   : Listar empleados con paginación y filtros.
 * - GET    /api/v1/rrhh/empleado/:id                               : Obtener el detalle de un empleado.
 * - PUT    /api/v1/rrhh/empleado/:id                               : Actualizar un empleado existente.
 * - DELETE /api/v1/rrhh/empleado/:id/desactivar                    : Desactivar un empleado (soft delete).
 * - PATCH  /api/v1/rrhh/empleado/:id/reactivar                     : Reactivar un empleado desactivado.
 * - PATCH  /api/v1/rrhh/empleado/:id/estado-laboral                : Cambiar el estado laboral de un empleado activo.
 * - GET    /api/v1/rrhh/empleado/dni/disponible/:nro_documento     : Verificar si un documento está disponible para registrar.
 * - GET    /api/v1/rrhh/empleado/dni/datos-reniec/:nro_documento   : Autocompletar nombre y apellidos desde RENIEC.
 */
@ApiSwaggerEmpleadosController()
@Controller('api/v1/rrhh/empleado')
@UseGuards(JwtAccessGuard, RolesGuard)
export class EmpleadoController {
  constructor(
    private readonly crearEmpleadoUseCase: CrearEmpleadoUseCase,
    private readonly editarEmpleadoUseCase: EditarEmpleadoUseCase,
    private readonly estadoEmpleadoUseCase: EstadoEmpleadoUseCase,
    private readonly listarEmpleadosUseCase: ListarEmpleadosUseCase
  ) {}

     /**
   * Endpoint para registrar un empleado completo en una sola operación atómica:
   * datos del empleado, datos financieros (cuentas y CCI se guardan encriptados) y derechohabientes.
   * Si no se envían nombre y apellido para un DNI de 8 dígitos, se autocompletan vía RENIEC.
   * Si algún derechohabiente es hijo menor o hijo mayor estudiante, se activa la asignación familiar.
   * @POST - /api/v1/rrhh/empleado
   * @roles ADMIN, RRHH - Solo usuarios con estos roles pueden acceder a este endpoint.
   * @body CrearSchemaEmpleadoCompletoDto {
   *   - datosEmpleado: datos personales, de contacto, domicilio, ubigeo, cargo, área y jornada,
   *   - datosFinanciero: régimen de pensión, AFP, sueldo, bancos, cuentas, CCI y régimen de salud/EPS,
   *   - derechosHabientes: lista opcional de derechohabientes
   * }
   * @returns 201 Created - Empleado creado con sus relaciones (área, cargo, jornada).
   *          400 Bad Request - Datos inválidos o AFP sin la información requerida.
   *          401 Unauthorized - El usuario no tiene un token válido.
   *          403 Forbidden - El usuario no tiene los permisos necesarios.
   *          404 Not Found - Área, cargo, jornada, tipo de documento, régimen, AFP o banco no encontrado.
   *          409 Conflict - Ya existe un empleado con ese número de documento.
   *          500 Internal Server Error - Fallo interno al crear el legajo.
   */
  @Post()
  @Roles('ADMIN', 'RRHH')
  @HttpCode(HttpStatus.CREATED)
  @ApiSwaggerCrearEmpleadoCompleto()
  async crearEmpleadoCompleto(@Body() dto: CrearSchemaEmpleadoCompletoDto) {
    return this.crearEmpleadoCompletoUseCase.execute(dto);
  }

  /**
   * Endpoint para crear un nuevo empleado (solo datos del legajo, sin datos financieros ni derechohabientes).
   * Si no se envían nombre y apellido para un DNI de 8 dígitos, se autocompletan vía RENIEC.
   * @POST - /api/v1/rrhh/empleado
   * @roles ADMIN, RRHH - Solo usuarios con estos roles pueden acceder a este endpoint.
   * @body CrearEmpleadoDto {
   *   - cargo_id: string (UUID del cargo),
   *   - area_id: string (UUID del área),
   *   - documento_id: string (UUID del tipo de documento),
   *   - jornada_id: string (UUID de la jornada, opcional),
   *   - nro_documento: string (8-20 caracteres, único),
   *   - nombre: string (3-100 caracteres, opcional para DNI: se autocompleta con RENIEC),
   *   - apellido: string (3-100 caracteres, opcional para DNI: se autocompleta con RENIEC),
   *   - email: string (formato válido),
   *   - telefono: string (máximo 20 caracteres),
   *   - sexo: string (MASCULINO, FEMENINO),
   *   - estado_civil: string (SOLTERO, CASADO, CONVIVIENTE, DIVORCIADO, VIUDO; por defecto SOLTERO),
   *   - nacionalidad: string (máximo 50 caracteres; por defecto PERUANA),
   *   - direccion: string (máximo 255 caracteres),
   *   - referencia_direccion: string (máximo 255 caracteres),
   *   - ubigeo: string (6 caracteres, código de ubigeo),
   *   - distrito: string (máximo 100 caracteres),
   *   - provincia: string (máximo 100 caracteres),
   *   - departamento: string (máximo 100 caracteres),
   *   - fecha_nacimiento: string (formato YYYY-MM-DD),
   *   - fecha_inicio: string (formato YYYY-MM-DD),
   *   - afp_fecha_filiacion: string (formato YYYY-MM-DD, opcional),
   *   - asig_familiar: boolean (opcional, por defecto false)
   * }
   * El estado laboral inicial siempre es ACTIVO.
   * @returns 201 Created - El empleado ha sido creado exitosamente.
   *          400 Bad Request - Los datos proporcionados son inválidos o el documento ya existe.
   *          401 Unauthorized - El usuario no tiene un token válido.
   *          403 Forbidden - El usuario no tiene los permisos necesarios.
   *          404 Not Found - Área, cargo, jornada o tipo de documento no encontrado.
   */
  @ApiSwaggerCrearEmpleado()
  @Post()
  @Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(CrearEmpleadoSchema))
  async crear(@Body() payload: CrearEmpleadoDto) {
    return await this.crearEmpleadoUseCase.execute(payload);
  }

  /**
   * Listar colaboradores con paginación y filtros
   * @GET - /api/v1/rrhh/empleados
   * @roles ADMIN, RRHH, CONTADOR, ASISTENTE - Solo usuarios con estos roles pueden acceder a este endpoint.
   * @Query queryParams : ListarEmpleadosQueryDto {
   *    "page": 1,
   *    "limit": 10,
   *    "area_id": "uuid",
   *    "cargo_id": "uuid",
   *    "activo": "Boolean",
   *    "nro_documento": "string",
   *    "search": "string"
   * }
   * @returns 200 OK - Lista de empleados con paginación y filtros aplicados.
   *          400 Bad Request - Los parámetros de consulta son inválidos.
   *          401 Unauthorized - El usuario no tiene un token válido.
   *          403 Forbidden - El usuario no tiene los permisos necesarios.
   * @throws NotFoundException - Si no se encuentran empleados que coincidan con los filtros proporcionados.
   * @throws BadRequestException - Si los parámetros de consulta son inválidos o no cumplen con el esquema definido.
   * @throws InternalServerErrorException - Si ocurre un error inesperado en el servidor al procesar la solicitud.
   */
  @ApiSwaggerListarEmpleados()
  @Get()
  @Roles('ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE')
  @UsePipes(new ZodValidationPipe(ListarEmpleadosQuerySchema)) // Aplica validación a los Query Params
  async obtenerTodos(@Query() queryParams: ListarEmpleadosQueryDto) {
    return await this.listarEmpleadosUseCase.execute(queryParams);
  }

  /**
   * Endpoint para actualizar la información de un empleado existente.
   * Requiere que el usuario tenga los roles de ADMIN o RRHH para acceder a este endpoint.
   * @PUT - /api/rrhh/empleado/:id
   * @roles ADMIN, RRHH - Solo usuarios con estos roles pueden acceder a este endpoint.
   * @param id : string - UUID del empleado a actualizar.
   * @param payload : EditarEmpleadoDto{
   *      *   - cargo_id: string (UUID del cargo),
   *   - area_id: string (UUID del área),
   *   - documento_id: string (UUID del tipo de documento),
   *   - jornada_id: string (UUID de la jornada, opcional),
   *   - nro_documento: string (8-20 carácteres, único),
   *   - estado_laboral: string (opcional, valores permitidos: ACTIVO, VACACIONES, LICENCIA, SUSPENDIDO),
   *   - nombre: string (3-100 carácteres),
   *   - apellido: string (3-100 carácteres),
   *   - email: string (formato válido),
   *   - telefono: string (máximo 20 carácteres),
   *   - sexo: string (valores permitidos: MASCULINO, FEMENINO),
   *   - estado_civil: string (valores permitidos: SOLTERO, CASADO, CONVIVIENTE, DIVORCIADO, VIUDO),
   *   - nacionalidad: string (máximo 50 carácteres),
   *   - direccion: string (máximo 255 carácteres),
   *   - referencia_direccion: string (máximo 255 carácteres),
   *   - ubigeo: string (6 carácteres, código de ubigeo),
   *   - distrito: string (máximo 100 carácteres),
   *   - provincia: string (máximo 100 carácteres),
   *   - fecha_nacimiento: string (formato YYYY-MM-DD),
   *   - fecha_ingreso: string (formato YYYY-MM-DD),
   *   - afp_fecha_filiacion: string (formato YYYY-MM-DD)
   *   - asign_familiar: boolean (opcional, por defecto false)
   * }
   * @returns 200 OK - El empleado ha sido actualizado exitosamente.
   *          400 Bad Request - Los datos proporcionados son inválidos.
   *          401 Unauthorized - El usuario no tiene un token válido.
   *          403 Forbidden - El usuario no tiene los permisos necesarios.
   *
   */
  @ApiSwaggerActualizarEmpleado()
  @Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(EditarEmpleadoSchema, true))
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async actualizarEmpleado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: EditarEmpleadoDto
  ) {
    return this.editarEmpleadoUseCase.execute(id, payload);
  }

  /**
   * Endpoint para desactivar un empleado (soft delete) en el sistema.
   * Requiere que el usuario tenga los roles de ADMIN o RRHH para acceder a este endpoint.
   * @DELETE - /api/v1/rrhh/empleado/:id/desactivar
   * @param id : string - uuid del empleado a desactivar.
   * @param dto : DesactivarEmpleadoDto (opcional) {
   *     - fecha_cese: string (opcional, formato YYYY-MM-DD),
   *     - motivo_cese: string (opcional, máximo 255 caracteres)
   * }
   * @returns 200 OK - El empleado ha sido desactivado exitosamente.
   *          400 Bad Request - Los datos proporcionados son inválidos.
   *          401 Unauthorized - El usuario no tiene un token válido.
   *          403 Forbidden - El usuario no tiene los permisos necesarios.
   */
  @ApiSwaggerDesactivarEmpleado()
  @Delete(':id/desactivar')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'RRHH')
  async desactivar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DesactivarEmpleadoSchema.optional()))
    dto?: DesactivarEmpleadoDto
  ) {
    return await this.estadoEmpleadoUseCase.desactivar(id);
  }

  /**
   * Endpoint para reactivar un empleado que se encuentra desactivado
   * @PATCH - /api/v1/rrhh/empleado/:id/reactivar
   * @param id - string - uuid del empleado a reactivar.
   * @returns 200 OK - El empleado ha sido reactivado exitosamente.
   *          400 Bad Request - Los datos proporcionados son inválidos.
   *          401 Unauthorized - El usuario no tiene un token válido.
   *          403 Forbidden - El usuario no tiene los permisos necesarios.
   */
  @ApiSwaggerReactivarEmpleado()
  @Patch(':id/reactivar')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'RRHH')
  async reactivar(@Param('id', ParseUUIDPipe) id: string) {
    return await this.estadoEmpleadoUseCase.reactivar(id);
  }

  /**
   * Endpoint para cambiar el estado laboral de un empleado ACTIVO
   * Cambiar el estado laboral de un empleados ACTIVOS
   * Los estados laborales permitidos son: ACTIVO, SUSPENDIDO, VACACIONES, LICENCIA
   * @PATCH - /api/rrhh/empleado/:id/estado-laboral
   * @roles ADMIN, RRHH - Solo usuarios con estos roles pueden acceder a este endpoint.
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
  @ApiSwaggerCambiarEstadoLaboral()
  @Patch(':id/estado-laboral')
  @Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(CambiarEstadoLaboralSchema))
  async cambiarEstadoLaboral(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoLaboralDto
  ) {
    return await this.estadoEmpleadoUseCase.cambiarEstadoLaboral(id, dto);
  }

  /**
   * Endpoint para obtener los detalles de un empleado por su ID.
   * Requiere que el usuario tenga los roles de ADMIN o RRHH para acceder a este endpoint.
   * @GET - /api/v1/rrhh/empleado/:id
   * @roles ADMIN, RRHH - Solo usuarios con estos roles pueden acceder a este endpoint.
   * @param id : string - UUID del empleado a consultar.
   * @returns 200 OK - Detalles del empleado.
   *         400 Bad Request - El ID proporcionado no es un UUID válido.
   *        401 Unauthorized - El usuario no tiene un token válido.
   *       403 Forbidden - El usuario no tiene los permisos necesarios.
   *       404 Not Found - El empleado no fue encontrado.
   */
  @Get(':id')
  @Roles('ADMIN', 'RRHH')
  @ApiDetalleEmpleado()
  async obtenerPorId(@Param('id', ParseUUIDPipe) id: string) {
    return this.listarEmpleadosUseCase.obtenerPorId(id);
  }
}
