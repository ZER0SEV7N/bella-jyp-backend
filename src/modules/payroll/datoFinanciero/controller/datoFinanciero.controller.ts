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

/**
 * Controlador encargado de manejar las peticiones HTTP de los datos financieros
 * Unicamente el ADMINISTRADOR, RRHH, CONTADOR, ASISTENTE puede obtener los datos financieros de un empleado
 * Para su registro y modificaciones SOLAMENTE tiene permisos el ADMIN, CONTADOR, RRHH
 */
@Controller('api/dato-financiero')
@UseGuards(JwtAccessGuard, RolesGuard)
export class DatoFinancieroController {
  constructor(
    private readonly agregarDatoFinanciero: AgregarDatoFinancieroUseCase,
    private readonly editarDatoFinanciero: EditarDatoFinancieroUseCase,
    private readonly obtenerDatoFinanciero: ObtenerDatoFinancieroUseCase
  ) {}

  /**
   * Obtene los datos financieros de un empleado
   * GET: /api/dato-financiero/empleado/{idEmpleado} 
   * @param IdEmpleado - El ID del empleado
   * @returns Un objeto con los datos financieros del empleado, con enmascaramiento de campos sensibles.
   * @throws NotFoundException si no se encuentran datos financieros para el empleado.
   * @throws UnauthorizedException si el usuario autenticado no tiene permisos para acceder a los datos.
   */
  @Get('empleado/:idEmpleado')
  @Roles('ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE')
  async obtenerDatos(@Param('idEmpleado', ParseUUIDPipe) IdEmpleado: string){
    return await this.obtenerDatoFinanciero.execute(IdEmpleado)
  }

  /**
   * Registra la informacion financiera inicial de un empleado.
   * POST: /api/dato-financiero
   * @payload - CrearDatoFinancieroDto {
   *    
   * }
   */
  @Post()
  @Roles('ADMIN', 'CONTADOR', 'RRHH')
  @UsePipes(new ZodValidationPipe(CrearDatoFinancieroSchema))
  async crear(@Body() payload: CrearDatoFinancieroDto){
    return await this.agregarDatoFinanciero.execute(payload);
  }

  /**
   * Actualiza datos financieros requiriendo re-confirmación de contraseña (Step-Up Auth).
   * PUT: /api/dato-financiero/empleado/{idEmpleado}
   */
  @Put('empleado/:idEmpleado')
  @Roles('ADMIN', 'CONTADOR')
  @UsePipes(new ZodValidationPipe(ActualizarDatoFinancieroSchema))
  async actualizar(@Param('idEmpleado', ParseUUIDPipe) IdEmpleado: string,
      @Body() payload: ActualizarDatoFinancieroDto,
      @Req() req: FastifyRequest & { user: {id: string} }
  ) {
    return await this.editarDatoFinanciero.execute(IdEmpleado, payload, req.user.id)
  }
}