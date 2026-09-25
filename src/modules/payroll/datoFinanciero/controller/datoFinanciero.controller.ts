//src/modules/payroll/datoFinanciero/controller/datoFinanciero.controller
import { Controller, Get, Post, Put, Param, Body, UseGuards, UsePipes, Req, ParseUUIDPipe } from '@nestjs/common'
import { JwtAccessGuard } from "@/common/guards/jwt-access.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import { CrearDatoFinancieroSchema, ActualizarDatoFinancieroSchema } from "@jyp/shared-contracts";
import type { CrearDatoFinancieroDto, ActualizarDatoFinancieroDto } from "@jyp/shared-contracts";
//use cases
import { AgregarDatoFinancieroUseCase } from "../use-case/agregarDatoFinanciero.useCase";
import { EditarDatoFinancieroUseCase } from "../use-case/editarDatoFinanciero.useCase";
import { ObtenerDatoFinancieroUseCase } from "../use-case/obtenerDatoFinanciero.useCase";
import type { FastifyRequest } from "fastify";
import { Roles } from "@/common/decorators/roles.decorator";
import { ApiSwaggerDatoFinancieroController, ApiSwaggerObtenerDatoFinanciero, ApiSwaggerCrearDatoFinanciero, ApiSwaggerActualizarDatoFinanciero } from "../decorators/datoFinanciero-swagger.decorator";

  /**
   * Controlador encargado de manejar las peticiones HTTP de los datos financieros
   * Unicamente el ADMINISTRADOR, RRHH, CONTADOR, ASISTENTE puede obtener los datos financieros de un empleado
   * Para su registro y modificaciones SOLAMENTE tiene permisos el ADMIN, CONTADOR, RRHH
   */
  @Controller('api/dato-financiero')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @ApiSwaggerDatoFinancieroController()
  export class DatoFinancieroController {
    constructor(
      private readonly agregarDatoFinanciero: AgregarDatoFinancieroUseCase,
      private readonly editarDatoFinanciero: EditarDatoFinancieroUseCase,
      private readonly obtenerDatoFinanciero: ObtenerDatoFinancieroUseCase
    ) {}

    /**
     * Obtene los datos financieros de un empleado
     * @GET : /api/dato-financiero/empleado/{idEmpleado} 
     * @ROLES : ADMIN, CONTADOR, RRHH, ASISTENTE
     * @param IdEmpleado - El ID del empleado
     * @returns Un objeto con los datos financieros del empleado, con enmascaramiento de campos sensibles.
     * @throws NotFoundException si no se encuentran datos financieros para el empleado.
     * @throws UnauthorizedException si el usuario autenticado no tiene permisos para acceder a los datos.
     */
    @Get('empleado/:idEmpleado')
    @ApiSwaggerObtenerDatoFinanciero()
    @Roles('ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE')
    async obtenerDatos(@Param('idEmpleado', ParseUUIDPipe) IdEmpleado: string){
      return await this.obtenerDatoFinanciero.execute(IdEmpleado);
    }

    /**
     * Registra la informacion financiera inicial de un empleado.
     * @POST : /api/dato-financiero
     * @ROLES : ADMIN, CONTADOR, RRHH
     * @payload - CrearDatoFinancieroDto {
     *    - empleado_id: string (UUID del empleado)
     *    - id_regimen: string (UUID del régimen previsional)
     *    - id_tipo_afp: string (UUID del tipo de AFP, opcional si es ONP)
     *    - cuspp: string (CUSPP del empleado, opcional si es ONP)
     *    - tipo_comision: string (Tipo de comisión AFP, opcional si es ONP)
     *    - sueldo_basico: number (Sueldo básico del empleado)
     *    - id_banco_sueldo: string (UUID del banco para la cuenta de sueldo, opcional)
     *    - tipo_cuenta_sueldo: string (Tipo de cuenta bancaria para sueldo, opcional)
     *    - nro_cuenta_sueldo: string (Número de cuenta bancaria para sueldo, opcional)
     *    - cci_sueldo: string (CCI de la cuenta bancaria para sueldo, opcional) 
     *    - id_banco_cts: string (UUID del banco para la cuenta de CTS, opcional)
     *    - tipo_cuenta_cts: string (Tipo de cuenta bancaria para CTS, opcional)
     *    - nro_cuenta_cts: string (Número de cuenta bancaria para CTS, opcional)
     *    - cci_cts: string (CCI de la cuenta bancaria para CTS, opcional) 
     *    - regimen_salud: string (Régimen de salud del empleado, opcional)
     *    - eps_nombre: string (Nombre de la EPS, opcional si es EsSalud)
     *    - eps_plan: string (Plan de la EPS, opcional si es EsSalud)
     *    - eps_costo_adicional: number (Costo adicional de la EPS, opcional si es EsSalud) 
     * }
     * @returns Un objeto con los datos financieros recién creados del empleado.
     * @throws BadRequestException si los datos no cumplen con las validaciones del esquema.
     * @throws UnauthorizedException si el usuario autenticado no tiene permisos para registrar datos financieros.
     */
    @Post()
    @ApiSwaggerCrearDatoFinanciero()
    @Roles('ADMIN', 'CONTADOR', 'RRHH')
    @UsePipes(new ZodValidationPipe(CrearDatoFinancieroSchema))
    async crear(@Body() payload: CrearDatoFinancieroDto){
      return await this.agregarDatoFinanciero.execute(payload);
    }

    /**
     * Actualiza datos financieros requiriendo re-confirmación de contraseña (Step-Up Auth).
     * @PUT : /api/dato-financiero/empleado/{idEmpleado}
     * @ROLES : ADMIN, RRHH
     * @param IdEmpleado - El ID del empleado
     * @payload - ActualizarDatoFinancieroDto {
     *    - id_regimen: string (UUID del régimen previsional, opcional)
     *    - id_tipo_afp: string (UUID del tipo de AFP, opcional si es ONP)
     *    - cuspp: string (CUSPP del empleado, opcional si es ONP)
     *    - tipo_comision: string (Tipo de comisión AFP, opcional si es ONP)
     *    - sueldo_basico: number (Sueldo básico del empleado, opcional)
     *    - id_banco_sueldo: string (UUID del banco para la cuenta de sueldo, opcional)
     *    - tipo_cuenta_sueldo: string (Tipo de cuenta bancaria para sueldo, opcional)
     *    - nro_cuenta_sueldo: string (Número de cuenta bancaria para sueldo, opcional)
     *    - cci_sueldo: string (CCI de la cuenta bancaria para sueldo, opcional)
     *    - id_banco_cts: string (UUID del banco para la cuenta de CTS, opcional)
     *    - tipo_cuenta_cts: string (Tipo de cuenta bancaria para CTS, opcional)
     */
    @Put('empleado/:idEmpleado')
    @ApiSwaggerActualizarDatoFinanciero()
    @Roles('ADMIN', 'RRHH')
    @UsePipes(new ZodValidationPipe(ActualizarDatoFinancieroSchema))
    async actualizar(@Param('idEmpleado', ParseUUIDPipe) IdEmpleado: string,
        @Body() payload: ActualizarDatoFinancieroDto,
        @Req() req: FastifyRequest & { user: {id: string} }
    ) {
      return await this.editarDatoFinanciero.execute(IdEmpleado, payload, req.user.id);
    }
  }