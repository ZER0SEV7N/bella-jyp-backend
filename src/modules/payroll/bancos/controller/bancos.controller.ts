//src/modules/payroll/bancos/controller/bancos.controller.ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAccessGuard } from "@/common/guards/jwt-access.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { ListarBancosUseCase } from "../use-cases/listarBancos.useCase";
import { ApiSwaggerBancosController, ApiSwaggerListarBancos } from "../decorators/bancos-swagger.decorator";

/**
 * Controlador de Bancos.
 * Este controlador maneja las operaciones relacionadas con los bancos, incluyendo la obtención de la lista de bancos activos.
 * Se requiere que el usuario tenga los roles 'ADMIN', 'CONTADOR', 'RRHH' o 'ASISTENTE' para poder acceder a estas operaciones.
 * @Controller('api/payroll/bancos') - Define la ruta base para todas las operaciones de este controlador.
 * @UseGuards(JwtAccessGuard, RolesGuard) - Aplica los guardias de autenticación y autorización a todas las rutas del controlador.
 * @ApiSwaggerBancosController() - Aplica los decoradores de Swagger para documentar el controlador en la API.
 */
@ApiSwaggerBancosController()
@Controller('api/payroll/bancos')
@UseGuards(JwtAccessGuard, RolesGuard)
export class BancosController {
    constructor(private readonly listarBancosUseCase: ListarBancosUseCase) {}

    /**
     * Obtiene la lista de bancos activos.
     * @GET /api/payroll/bancos
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
}