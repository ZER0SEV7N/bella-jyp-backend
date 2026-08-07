//src/modules/usuarios/controller/usuarios.controller.ts
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { ObtenerMiPerfilUseCase } from '../use-cases/obtenerMiPerfil.useCase';
import type { FastifyRequest } from 'fastify';
import type { MiPerfilResponseDto } from '@jyp/shared-contracts';

/**
 * Controlador para manejar las operaciones relacionadas con los usuarios
 */
@Controller('api/usuarios')
@UseGuards(JwtAccessGuard) //Protege todas las rutas de este controlador con JWT
export class UsuariosController {
  constructor(
    private readonly obtenerMiPerfilUseCase: ObtenerMiPerfilUseCase,
  ) {}

  /**
   * Endpoint para obtener el perfil del usuario autenticado
   * GET /api/usuarios/me
   * @param req - La solicitud HTTP que contiene la información del usuario autenticado
   * @returns - Un objeto que representa el perfil del usuario
   *          - 200 OK: Devuelve el perfil del usuario
   *          - 404 Not Found: Si el usuario no se encuentra
   *          - 500 Internal Server Error: Si ocurre un error inesperado
   */
  @Get('me')
  async obtenerMiPerfil(
    @Req() req: FastifyRequest & { user: { id: string } },
  ): Promise<MiPerfilResponseDto> {
    return await this.obtenerMiPerfilUseCase.obtenerPerfil(req.user.id);
  }
}
