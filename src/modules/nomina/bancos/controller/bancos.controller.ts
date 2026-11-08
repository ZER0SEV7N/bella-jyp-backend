//src/modules/nomina/bancos/controller/bancos.controller.ts
import { Controller, Get, UseGuards, Param, ParseUUIDPipe } from '@nestjs/common';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ListarBancosUseCase } from '../use-cases/listarBancos.useCase';
import { ApiSwaggerBancosController, ApiSwaggerListarBancos, ApiSwaggerObtenerBancoPorId } from '../decorators/bancos-swagger.decorator';

/**
 * Controlador de Bancos.
 * Este controlador maneja las operaciones relacionadas con los bancos, incluyendo la obtención de la lista de bancos activos.
 * Se requiere que el usuario tenga los roles 'ADMIN', 'CONTADOR', 'RRHH' o 'ASISTENTE' para poder acceder a estas operaciones.
 * @Controller('api/v1/nomina/bancos') - Define la ruta base para todas las operaciones de este controlador.
 * @UseGuards(JwtAccessGuard, RolesGuard) - Aplica los guardias de autenticación y autorización a todas las rutas del controlador.
 * @ApiSwaggerBancosController() - Aplica los decoradores de Swagger para documentar el controlador en la API.
 */
@ApiSwaggerBancosController()
@Controller('api/v1/nomina/bancos')
@UseGuards(JwtAccessGuard, RolesGuard)
export class BancosController {
  constructor(private readonly listarBancosUseCase: ListarBancosUseCase) {}

  /**
   * Obtiene la lista de bancos activos.
   * @GET /api/v1/nomina/bancos
   * Este endpoint devuelve un arreglo de objetos que representan los bancos activos, incluyendo su id, nombre, código y estado de actividad.
   * @returns - Una promesa que resuelve con un arreglo de objetos que representan los bancos activos.
   * @Roles('ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE') - Requiere que el usuario tenga uno de estos roles para poder acceder a esta operación.
   */
  @Get()
  @Roles('ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE')
  @ApiSwaggerListarBancos()
  async listarBancos() {
    return await this.listarBancosUseCase.execute();
  }

  /**
   * Obtiene un banco por su ID.
   * @GET /api/v1/nomina/bancos/:id
   * Este endpoint devuelve un objeto que representa un banco específico, identificado por su ID.
   * @param id - El ID del banco a obtener, que debe ser un UUID válido.
   * @returns - Una promesa que resuelve con un objeto que representa el banco especificado por su ID.
   */
  @Get(':id')
  @Roles('ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE')
  @ApiSwaggerObtenerBancoPorId()
  obtenerPorId(@Param('id', ParseUUIDPipe) id: string) {
    return this.listarBancosUseCase.obtenerPorId(id);
  }
}
