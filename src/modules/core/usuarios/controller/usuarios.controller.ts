//src/modules/core/usuarios/controller/usuarios.controller.ts
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { ObtenerMiPerfilUseCase } from '../use-cases/obtenerMiPerfil.useCase';
import type { FastifyRequest } from 'fastify';
import type { MiPerfilResponseDto } from '@jyp/shared-contracts';
import { ApiSwaggerUsuariosController, ApiSwaggerObtenerMiPerfil, ApiSwaggerCambiarEstado, ApiSwaggerCambiarMiPassword, ApiSwaggerCambiarRol, ApiSwaggerListarUsuarios } from '../decorators/usuarios-swagger.decorators';
import { GestionUsuariosUseCase } from '../use-cases/gestionarUsuarios.useCase';
import { CambiarMiPasswordUseCase } from '../use-cases/cambiarMiPassword.useCase';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';

/**
 * Controlador de usuarios que expone endpoints para la gestión de cuentas de usuario y el perfil del usuario autenticado.
 * Este controlador utiliza casos de uso para obtener el perfil del usuario, listar usuarios, cambiar estado y rol de usuarios, y cambiar la contraseña del usuario autenticado.
 * Todos los endpoints están protegidos por JWT y requieren que el usuario tenga los roles adecuados para acceder a ciertas operaciones.
 * Las uris disponibles son:
 * - GET /api/v1/core/usuarios/me: Obtiene el perfil del usuario autenticado.
 * - GET /api/v1/core/usuarios: Lista las cuentas de usuario con filtros y paginación (requiere rol ADMIN o RRHH).
 * - PATCH /api/v1/core/usuarios/:id/estado: Cambia el estado activo/inactivo de un usuario (requiere rol ADMIN o RRHH).
 * - PATCH /api/v1/core/usuarios/:id/rol: Cambia el rol de un usuario (requiere rol ADMIN).
 * - PATCH /api/v1/core/usuarios/me/password: Permite al usuario autenticado cambiar su propia contraseña.
 */
@Controller('api/v1/core/usuarios')
@UseGuards(JwtAccessGuard, RolesGuard) //Protege todas las rutas de este controlador con JWT
@ApiSwaggerUsuariosController() //Documentación Swagger para el módulo de usuarios
export class UsuariosController {
  constructor(
    private readonly obtenerMiPerfilUseCase: ObtenerMiPerfilUseCase,
    private readonly gestionUsuariosUseCase: GestionUsuariosUseCase,
    private readonly cambiarMiPasswordUseCase: CambiarMiPasswordUseCase,
  ) {}

  /**
   * Endpoint para obtener el perfil del usuario autenticado.
   * Este endpoint devuelve los datos del perfil del usuario que está actualmente autenticado en el sistema, incluyendo su información personal y laboral.
   * La información se obtiene a partir del ID del usuario presente en el token JWT de la solicitud.
   * @GET /api/v1/core/usuarios/me
   * @param req - La solicitud HTTP que contiene la información del usuario autenticado
   * @returns - Un objeto que representa el perfil del usuario
   *          - 200 OK: Devuelve el perfil del usuario
   *          - 404 Not Found: Si el usuario no se encuentra
   *          - 500 Internal Server Error: Si ocurre un error inesperado
   */
  @Get('me')
  @ApiSwaggerObtenerMiPerfil()
  async obtenerMiPerfil(@Req() req: FastifyRequest & { user: { id: string } } ): Promise<MiPerfilResponseDto> {
    return await this.obtenerMiPerfilUseCase.obtenerPerfil(req.user.id);
  }

  /**
   * Endpoint para listar las cuentas de usuario con filtros y paginación.
   * Este endpoint permite a los usuarios con roles ADMIN o RRHH obtener una lista de cuentas de usuario en el sistema.
   * Se pueden aplicar filtros como rol, estado activo/inactivo y búsqueda por texto, así como paginación mediante parámetros de página y límite.
   * @GET /api/v1/core/usuarios
   * @param page - Número de página para la paginación (opcional)
   * @param limit - Número de resultados por página para la paginación (opcional)
   * @param rol - Filtra los usuarios por rol (opcional)
   * @param activo - Filtra los usuarios por estado activo/inactivo (opcional)
   * @param search - Filtra los usuarios por búsqueda de texto en nombre, correo o documento (opcional)
   * @returns - Un objeto que contiene la lista de usuarios y metadatos de paginación
   *         - 200 OK: Devuelve la lista de usuarios con metadatos de paginación
   *         - 401 Unauthorized: Si el usuario no tiene permisos para acceder a este endpoint
   *         - 404 Not Found: Si no se encuentran usuarios que coincidan con los filtros
   *         - 500 Internal Server Error: Si ocurre un error inesperado
   */
  @Get()
  @Roles('ADMIN', 'RRHH')
  @ApiSwaggerListarUsuarios()
  async listarUsuarios(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('rol') rol?: string,
    @Query('activo') activo?: string,
    @Query('search') search?: string,
  ) {
    return this.gestionUsuariosUseCase!.listar({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      rol,
      activo: activo === undefined ? undefined : activo === 'true',
      search,
    });
  }

  /**
   * Endpoint para cambiar el estado activo/inactivo de un usuario.
   * Este endpoint permite a los usuarios con roles ADMIN o RRHH cambiar el estado de un usuario específico en el sistema.
   * Se debe proporcionar el ID del usuario objetivo y el nuevo estado (activo o inactivo) en el cuerpo de la solicitud.
   * El actor que realiza la acción se obtiene a partir del token JWT de la solicitud.
   * @PATCH /api/v1/core/usuarios/:id/estado
   * @param id - El ID del usuario cuyo estado se desea cambiar (debe ser un UUID válido)
   * @param body - Un objeto que contiene el nuevo estado activo del usuario (activo: true o false)
   * @body :
   * @param req - La solicitud HTTP que contiene la información del usuario autenticado
   * @returns - Un objeto que representa el usuario actualizado con su nuevo estado
   */
  @Patch(':id/estado')
  @ApiSwaggerCambiarEstado()
  @Roles('ADMIN', 'RRHH')
  async cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { activo: boolean },
    @Req() req: FastifyRequest & { user: { id: string; rol: string } },
  ) {
    return this.gestionUsuariosUseCase!.cambiarEstado(id, Boolean(body.activo), req.user);
  }

  /**
  * Endpoint para cambiar el rol de un usuario.
  * Este endpoint permite a los usuarios con rol ADMIN cambiar el rol de un usuario específico en el sistema.
  * Se debe proporcionar el ID del usuario objetivo y el nuevo rol en el cuerpo de la solicitud.
  * El actor que realiza la acción se obtiene a partir del token JWT de la solicitud.
  * @PATCH /api/v1/core/usuarios/:id/rol
  * @param id - El ID del usuario cuyo rol se desea cambiar (debe ser un UUID válido)
  * @param body - Un objeto que contiene el nuevo rol del usuario
  * @body : {
  *   - rol: string; // El nuevo rol que se desea asignar al usuario objetivo
  * }
  * @param req - La solicitud HTTP que contiene la información del usuario autenticado
  * @returns - Un objeto que representa el usuario actualizado con su nuevo rol
  */
  @Patch(':id/rol')
  @Roles('ADMIN')
  @ApiSwaggerCambiarRol()
  async cambiarRol( @Param('id', ParseUUIDPipe) id: string, @Body() body: { rol: string }, @Req() req: FastifyRequest & { user: { id: string; rol: string } } ) {
    return this.gestionUsuariosUseCase!.cambiarRol(id, body.rol, req.user);
  }

  /**
   * Endpoint para cambiar la contraseña de un usuario.
   * Permite que el usuario autenticado cambie su propia contraseña verificando la actual (USR-M1).
   * El usuario debe proporcionar su contraseña actual y la nueva contraseña en el cuerpo de la solicitud.
   * @PATCH /api/v1/core/usuarios/me/password
   * @param body - Un objeto que contiene la contraseña actual y la nueva contraseña del usuario
   * @body : {
   * - password_actual: string; // La contraseña actual del usuario
   * - nueva_password: string; // La nueva contraseña que el usuario desea establecer
   * }
   * @param req - La solicitud HTTP que contiene la información del usuario autenticado
   * @returns - Un objeto con un mensaje de éxito si la contraseña se actualizó correctamente
   *          - 200 OK: Si la contraseña se cambió exitosamente
   */
  @Patch('me/password')
  @ApiSwaggerCambiarMiPassword()
  async cambiarMiPassword(@Body() body: { password_actual: string; nueva_password: string }, @Req() req: FastifyRequest & { user: { id: string } } ) {
    return this.cambiarMiPasswordUseCase.cambiarMiPassword(
      req.user.id,
      body.password_actual,
      body.nueva_password,
    );
  }
}
