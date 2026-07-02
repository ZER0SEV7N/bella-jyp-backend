//src/modules/auth/controller/auth.controller.ts
//Controlador de autenticación para manejar las rutas y solicitudes relacionadas con la autenticación
import { Controller, Post, Body, Res, UsePipes, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { LoginUseCase } from '../use-cases/login.useCase';
import { ProvisionarUsuarioUseCase } from '../use-cases/crearUsuarioInterno.useCase';
import { RecuperacionPasswordUseCases } from '../use-cases/recuperacionPassword.useCases';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { LoginSchema, ProvisionarUsuarioSchema, SolicitudRecuperacionSchema } from '@jyp/shared-contracts';
import type { LoginDTO, ProvisionarUsuarioDTO, SolicitudRecuperacionDTO } from '@jyp/shared-contracts';
@Controller('api/auth')
export class AuthController {
    constructor(
        private readonly loginUseCase: LoginUseCase,
        private readonly provisionarUsuarioUseCase: ProvisionarUsuarioUseCase,
        private readonly recuperacionPasswordUseCase: RecuperacionPasswordUseCases
    ) {}

    //POST: /api/auth/login
    //Ruta para autenticar un usuario y generar un Access Token y Refresh Token
    //REQUEST BODY: { tipo_documento: string, 
    //                nro_documento: string, 
    //                 password: string 
    //              }
    //RESPONSE: { accessToken: string, usuario: { id: number, rol: string, nro_documento: string } }
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @UsePipes(new ZodValidationPipe(LoginSchema))
    async login(@Body() payload: LoginDTO, @Res({ passthrough: true}) res: FastifyReply) {
        const { accessToken, refreshToken, usuario } = await this.loginUseCase.execute(payload);

        res.setCookie('jyp_rt', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api/auth/refresh',
            maxAge: 7 * 24 * 60 * 60, // 7 días
        });

        return { accessToken, usuario, };
    }

    //POST: /api/auth/provisionar
    //Ruta para provisionar un nuevo usuario, solo accesible para usuarios con rol ADMIN o RRHH
    //REQUEST BODY: { tipo_documento: string, 
    //                nro_documento: string, 
    //                password: string, 
    //                rol: string, 
    //                email?: string, 
    //                empleado_id?: number 
    //              }
    //RESPONSE: { id: number, rol: string, nro_documento: string }
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

    @Post('recuperar-password')
    @HttpCode(HttpStatus.OK)
    @UsePipes(new ZodValidationPipe(SolicitudRecuperacionSchema))
    async solicitarRecuperacion(@Body() payload: SolicitudRecuperacionDTO) {
        return await this.recuperacionPasswordUseCase.solicitar(payload);
    }
}
