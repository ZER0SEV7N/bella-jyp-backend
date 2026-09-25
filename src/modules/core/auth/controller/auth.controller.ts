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
import { LoginSchema, ProvisionarUsuarioSchema, SolicitudRecuperacionSchema } from '@jyp/shared-contracts';
import type {LoginDTO, ProvisionarUsuarioDTO, SolicitudRecuperacionDTO } from '@jyp/shared-contracts';
import {ApiSwaggerController, ApiSwaggerLogin, ApiSwaggerRefresh, ApiSwaggerProvisionar, ApiSwaggerRecuperarPassword, ApiSwaggerLogout} from '../decorators/auth-swagger.decorator';

/**
 * Controlador de autenticación para manejar las rutas y solicitudes relacionadas con la autenticación.
 * Este controlador expone endpoints para iniciar sesión, refrescar tokens, provisionar usuarios y solicitar recuperación de contraseña.
 * Utiliza casos de uso específicos para cada operación y aplica validaciones y guardias según sea necesario.
 */
@ApiSwaggerController()
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly provisionarUsuarioUseCase: ProvisionarUsuarioUseCase,
    private readonly recuperacionPasswordUseCase: RecuperacionPasswordUseCases,
    private readonly refrescarTokenUseCase: RefrescarTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase
  ) {}

  /**
   * Ruta para iniciar sesión y obtener tokens de acceso y refresco.
   * POST: /api/auth/login
   * @REQUEST BODY: {
   *              nro_documento: string,
   *              password: string
   *            }
   * @returns: { accessToken: string, usuario: { id: number, rol: string, nro_documento: string } }
   * @SET-COOKIE: jyp_rt=refreshToken;
   * @yields 2023-06-15 12:00:00 - Usuario con nro_documento '12345678' ha iniciado sesión exitosamente.
   * @yields 2023-06-15 12:00:00 - Usuario con nro_documento '12345678' ha fallado al iniciar sesión. Razón: Contraseña incorrecta.
   * @yields 2023-06-15 12:00:00 - Usuario con nro_documento '12345678' ha fallado al iniciar sesión. Razón: Usuario no encontrado.
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
   * Ruta para refrescar el token de acceso utilizando el refresh token almacenado en la cookie.
   * POST: /api/auth/refresh
   * @SET-COOKIE: jyp_rt=refreshToken;
   * @returns: { accessToken: string }
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
   * Ruta para provisionar un nuevo usuario, solo accesible para usuarios con rol ADMIN o RRHH
   * POST: /api/auth/provisionar
   * @REQUEST BODY: { tipo_documento: string,
   *                  nro_documento: string,
   *                  password: string,
   *                  email?: string,
   *                  rol: string,
   *                  empleado_id?: number
   *            }
   * @returns: { id: number, rol: string, nro_documento: string }
   */
  @ApiSwaggerProvisionar()
  @Post('provisionar')
  @HttpCode(HttpStatus.CREATED)
  // @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(ProvisionarUsuarioSchema))
  async provisionar(@Body() payload: ProvisionarUsuarioDTO) {
    //Retorno directo, cero formateo en el controlador
    return await this.provisionarUsuarioUseCase.execute(payload);
  }

  /**
   * Ruta para solicitar la recuperación de contraseña, enviando un correo con un enlace de restablecimiento.
   * POST: /api/auth/recuperar-password
   * @REQUEST BODY: { nro_documento: string }
   * @returns { message: string }
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
}
