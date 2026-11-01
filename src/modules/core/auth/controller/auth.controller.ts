//src/modules/core/auth/controller/auth.controller.ts
//Controlador de autenticación para manejar las rutas y solicitudes relacionadas con la autenticación
import {Controller, Post, Body, Res, UsePipes, HttpCode, HttpStatus, UseGuards, UnauthorizedException, Req} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { LoginUseCase } from '../use-cases/login.useCase';
import { ProvisionarUsuarioUseCase } from '../use-cases/provisionarUsuario.useCase';
import { RecuperacionPasswordUseCases } from '../use-cases/recuperacionPassword.useCases';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { RefrescarTokenUseCase } from '../use-cases/refrescarToken.useCase';
import { LogoutUseCase } from '../use-cases/logout.useCase';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { LoginSchema, ProvisionarUsuarioSchema, RestablecerPasswordSchema, SolicitudRecuperacionSchema } from '@jyp/shared-contracts';
import type {LoginDTO, ProvisionarUsuarioDTO, RestablecerPasswordDTO, SolicitudRecuperacionDTO } from '@jyp/shared-contracts';
import {ApiSwaggerController, ApiSwaggerLogin, ApiSwaggerRefresh, ApiSwaggerProvisionar, ApiSwaggerRecuperarPassword, ApiSwaggerLogout, ApiSwaggerRestablecerPassword} from '../decorators/auth-swagger.decorator';

/**
 * Controlador de autenticación para manejar las rutas y solicitudes relacionadas con la autenticación.
 * Este controlador expone endpoints para iniciar sesión, refrescar tokens, provisionar usuarios y solicitar recuperación de contraseña.
 * Utiliza casos de uso específicos para cada operación y aplica validaciones y guardias según sea necesario.
 * Endpoints:
 * - POST /api/auth/login: Inicia sesión y emite tokens de acceso y refresco.
 * - POST /api/auth/refresh: Refresca el token de acceso utilizando el token de refresco.
 * - POST /api/auth/provisionar: Provisiona un nuevo usuario (requiere rol ADMIN o RRHH).
 * - POST /api/auth/recuperar-password: Solicita la recuperación de contraseña enviando un correo con un enlace de restablecimiento.
 * - POST /api/auth/logout: Cierra sesión e invalida los tokens.
 */
@ApiSwaggerController()
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly provisionarUsuarioUseCase: ProvisionarUsuarioUseCase,
    private readonly recuperacionPasswordUseCase: RecuperacionPasswordUseCases,
    private readonly refrescarTokenUseCase: RefrescarTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase
  ) {}

  /**
   * Endpoint para iniciar sesión en el sistema utilizando credenciales de usuario.
   * @POST /api/auth/login
   * @param payload - LoginDTO - Objeto que contiene las credenciales de inicio de sesión (número de documento y contraseña).
   * @body - LoginDTO: {
   *    - tipo_documento: string - Tipo de documento del usuario.
   *    - nro_documento: string - Número de documento del usuario.
   *    - password: string - Contraseña del usuario.
   * }
   * @returns - Un objeto que contiene el access token, la información del usuario y establece una cookie HttpOnly con el refresh token.
   * @throws - Lanza una excepción UnauthorizedException si las credenciales son inválidas o la cuenta de usuario está inactiva.
   * @yields 2023-06-15 12:00:00 - Usuario con ID '123' ha iniciado sesión exitosamente. Access token emitido y refresh token almacenado en cookie HttpOnly.
   */
  @ApiSwaggerLogin()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(@Body() payload: LoginDTO, @Res({ passthrough: true }) res: FastifyReply) {
    const { accessToken, refreshToken, usuario } = await this.loginUseCase.execute(payload);

    res.setCookie('jyp_rt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 días
    });

    return { accessToken, usuario };
  }

  /**
   * Endpoint para refrescar el token de acceso utilizando el token de refresco almacenado en una cookie HttpOnly.
   * @POST /api/auth/refresh
   * @param req - FastifyRequest - La solicitud HTTP entrante, que contiene la cookie de refresh token.
   * @param res - FastifyReply - La respuesta HTTP que se enviará al cliente, utilizada para establecer la nueva cookie de refresh token si es necesario.
   * @returns - Un objeto que contiene el nuevo access token.
   * @throws - Lanza una excepción UnauthorizedException si no se encuentra la cookie de refresh token o si el token es inválido o ha sido revocado.
   * @yields 2023-06-15 12:00:00 - Usuario con ID '123' ha refrescado su access token exitosamente. Nuevo access token emitido y refresh token actualizado en cookie HttpOnly.
   * @yields 2023-06-15 12:00:00 - Usuario con ID '123' ha intentado refrescar su access token pero la cookie de refresh token no fue encontrada. Se requiere iniciar sesión nuevamente.
   * @yields 2023-06-15 12:00:00 - Usuario con ID '123' ha intentado refrescar su access token pero el refresh token ha sido revocado o es inválido. Se requiere iniciar sesión nuevamente.
   * @yields 2023-06-15 12:00:00 - Usuario con ID '123' ha refrescado su access token exitosamente. Nuevo access token emitido y refresh token no ha cambiado.
   */
  @ApiSwaggerRefresh()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    //Obtener el refresh token de las cookies de la solicitud
    const refreshToken = req.cookies?.['jyp_rt'];
    //Si no se encuentra en las cookies, intentar obtenerlo del encabezado de la solicitud (por si acaso)
    if (!refreshToken) {
      throw new UnauthorizedException({
        title: 'Sesión Expirada',
        detail: 'No se encontró la cookie de refresco. Inicie sesión nuevamente.',
      });
    }

    const { accessToken, newRefreshToken } = await this.refrescarTokenUseCase.execute(refreshToken);

    if (newRefreshToken) {
      res.setCookie('jyp_rt', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return { accessToken };
  }

  /**
   * Endpoint para provisionar un nuevo usuario en el sistema.
   * @POST /api/auth/provisionar
   * @roles - Requiere que el usuario tenga el rol de 'ADMIN' o 'RRHH'.
   * @param payload - ProvisionarUsuarioDTO - Objeto que contiene la información del nuevo usuario a provisionar.
   * @body - ProvisionarUsuarioDTO: {
   *    - tipo_documento: string - Tipo de documento del nuevo usuario.
   *    - nro_documento: string - Número de documento del nuevo usuario.
   *    - nombres: string - Nombres del nuevo usuario.
   *    - apellidos: string - Apellidos del nuevo usuario.
   *    - email: string - Correo electrónico del nuevo usuario.
   *    - rol: string - Rol del nuevo usuario (por ejemplo, 'ADMIN', 'RRHH', 'CONTADOR', etc.).
   *    - password: string - Contraseña inicial del nuevo usuario.
   * }
   * @returns - Un objeto que contiene la información del usuario provisionado.
   * @throws - Lanza una excepción UnauthorizedException si el usuario autenticado no tiene los roles requeridos.
   * @yields 2023-06-15 12:00:00 - Usuario con ID '123' ha provisionado un nuevo usuario con ID '456' exitosamente.
   */
  @ApiSwaggerProvisionar()
  @Post('provisionar')
  @HttpCode(HttpStatus.CREATED)
  //@UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('JYP','ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(ProvisionarUsuarioSchema))
  async provisionar(@Body() payload: ProvisionarUsuarioDTO) {
    //Retorno directo, cero formateo en el controlador
    return await this.provisionarUsuarioUseCase.execute(payload);
  }

  /**
   * Endpoint para solicitar la recuperación de contraseña de un usuario.
   * @POST /api/auth/recuperar-password
   * @param payload - SolicitudRecuperacionDTO - Objeto que contiene la información necesaria para solicitar la recuperación de contraseña.
   * @body - SolicitudRecuperacionDTO: {
   *    - email: string - Correo electrónico del usuario que solicita la recuperación de contraseña.
   * }
   * @returns - Un objeto con un mensaje indicando que se ha enviado un correo con instrucciones para restablecer la contraseña.
   * @throws - Lanza una excepción UnauthorizedException si el correo electrónico no está registrado en el sistema.
   * @yields 2023-06-15 12:00:00 - Usuario con correo '
   */
  @ApiSwaggerRecuperarPassword()
  @Post('recuperar-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(SolicitudRecuperacionSchema))
  async solicitarRecuperacion(@Body() payload: SolicitudRecuperacionDTO) {
    return await this.recuperacionPasswordUseCase.solicitar(payload);
  }
  
  /**
   * Ruta para cerrar sesión, invalidando el refresh token y el access token.
   * POST: /api/auth/logout
   * @param req - FastifyRequest - La solicitud HTTP entrante, que contiene la cookie de refresh token y el encabezado de autorización con el access token.
   * @param res - FastifyReply - La respuesta HTTP que se enviará al cliente, utilizada para limpiar la cookie de refresh token.
   * @returns - Un objeto con un mensaje de éxito indicando que la sesión ha sido finalizada y los tokens han sido invalidados.
   * @throws - Lanza una excepción UnauthorizedException si ocurre un problema al invalidar los tokens.
   * @yields 2023-06-15 12:00:00 - Usuario con ID '123' ha cerrado sesión exitosamente. Refresh token y access token invalidados.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiSwaggerLogout()
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const refreshToken = req.cookies?.['jyp_rt'];
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7): undefined;

    await this.logoutUseCase.execute(refreshToken, accessToken);

    //Limpiar la cookie de refresh token en el cliente estableciendo su valor a vacío y maxAge a 0
    res.setCookie('jyp_rt', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    });

    return {
      title: 'Sesión Finalizada',
      detail: 'Tokens invalidados exitosamente.'
    };
  }

  /**
   * Ruta para restablecer la contraseña de un usuario.
   * @POST /api/auth/restablecer-password
   * @roles - No requiere roles específicos, accesible para cualquier usuario que tenga un token de restablecimiento válido.
   * @param payload - RestablecerPasswordDTO - Objeto que contiene la información necesaria para restablecer la contraseña, validado mediante ZodValidationPipe.
   * RestablecerPasswordDTO : {
   *    - token: string - Token de restablecimiento de contraseña enviado al correo del usuario.
   *    - newPassword: string - Nueva contraseña que el usuario desea establecer.
   * }
   * @HttpCode(HttpStatus.OK) - Indica que la respuesta HTTP tendrá un código de estado 200 OK si la operación es exitosa.
   * @UsePipes(new ZodValidationPipe(RestablecerPasswordSchema)) - Aplica la validación de esquema Zod al cuerpo de la solicitud.
   * @returns - Un objeto con un mensaje de éxito indicando que la contraseña ha sido restablecida correctamente.
   */
  @Post('restablecer-password')
  @HttpCode(HttpStatus.OK)
  @ApiSwaggerRestablecerPassword()
  
  restablecerPassword(@Body(new ZodValidationPipe(RestablecerPasswordSchema)) payload: RestablecerPasswordDTO) {
    return this.recuperacionPasswordUseCase.restablecer(payload);
  }
}
