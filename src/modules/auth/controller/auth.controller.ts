//src/modules/auth/controller/auth.controller.ts
//Controlador de autenticación para manejar las rutas y solicitudes relacionadas con la autenticación
import { Controller, Post, Body, Res, UsePipes, HttpCode, HttpStatus, UseGuards, UnauthorizedException} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { LoginUseCase } from '../use-cases/login.useCase';
import { ProvisionarUsuarioUseCase } from '../use-cases/provisionarUsuario.useCase';
import { RecuperacionPasswordUseCases } from '../use-cases/recuperacionPassword.useCases';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { RefrescarTokenUseCase } from '../use-cases/refrescarToken.useCase';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import {
  LoginSchema,
  ProvisionarUsuarioSchema,
  SolicitudRecuperacionSchema,
} from '@jyp/shared-contracts';
import type {
  LoginDTO,
  ProvisionarUsuarioDTO,
  SolicitudRecuperacionDTO,
} from '@jyp/shared-contracts';
import {
  ApiSwaggerController,
  ApiSwaggerLogin,
  ApiSwaggerRefresh,
  ApiSwaggerProvisionar,
  ApiSwaggerRecuperarPassword,
} from '../decorators/auth-swagger.decorator';

@ApiSwaggerController()
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly provisionarUsuarioUseCase: ProvisionarUsuarioUseCase,
    private readonly recuperacionPasswordUseCase: RecuperacionPasswordUseCases,
    private readonly refrescarTokenUseCase: RefrescarTokenUseCase,
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
  async login(
    @Body() payload: LoginDTO,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { accessToken, refreshToken, usuario } =
      await this.loginUseCase.execute(payload);

    res.setCookie('jyp_rt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60, // 7 días
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
  async refreshToken(@Res({ passthrough: true }) res: FastifyReply) {
    //Obtener el refresh token de las cookies de la solicitud
    let refreshToken = res.cookies?.['jyp_rt'];
    //Si no se encuentra en las cookies, intentar obtenerlo del encabezado de la solicitud (por si acaso)
    if (!refreshToken && res.request.headers.cookie) {
      const rawCookies = res.request.headers.cookie.split(';').reduce(
        (acc, current) => {
          const [key, value] = current.trim().split('=');
          if (key && value) acc[key] = value;

          return acc;
        },
        {} as Record<string, string>,
      );

      refreshToken = rawCookies['jyp_rt'];
    }

    //Si no se encuentra en las cookies ni en el encabezado, lanzar una excepción de autorización
    if (!refreshToken)
      throw new UnauthorizedException(
        'No se encontró el Refresh Token en las cookies o ha expirado.',
      );

    const { accessToken } =
      await this.refrescarTokenUseCase.execute(refreshToken);
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
  // EL MURO DE DEFENSA: Primero valida el JWT, luego valida el Rol de quien hace la petición
  // @UseGuards(JwtAccessGuard, RolesGuard) <-- Descomenta en producción
  // @Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(ProvisionarUsuarioSchema))
  async provisionar(@Body() payload: ProvisionarUsuarioDTO) {
    // Retorno directo, cero formateo en el controlador
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
}
