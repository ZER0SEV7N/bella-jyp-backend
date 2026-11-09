//src/modules/core/auth/use-cases/login.useCase.ts
//Caso de uso para el login de usuarios internos
//Se encarga de autenticar a un usuario interno y generar tokens JWT
import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { PrismaService } from '@/common/prisma/prisma.service';
import { LoginDTO } from '@jyp/shared-contracts';
import { ControlIntentosService } from '@/common/guards/control-intentos.service';
import { construirPayloadJwt, DUMMY_ARGON2_HASH, obtenerSecretoJwt } from '../helpers/auth-token.helper';
import { IdentityGenerator } from '@/common/utils/uuid.util';

/**
 * Caso de uso para el login de usuarios internos.
 * Este caso de uso se encarga de autenticar a un usuario interno mediante su número de documento,
 * tipo de documento y contraseña. Si la autenticación es exitosa, se generan tokens JWT (access y refresh)
 * y se persiste la sesión en la base de datos.
 */
@Injectable()
export class LoginUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Optional() private readonly controlIntentos?: ControlIntentosService,
  ) {}

  /**
   * Metodo principal para ejecutar el caso de uso de login.
   * Verifica las credenciales del usuario, maneja los intentos de login fallidos y genera tokens JWT si la autenticación es exitosa.
   * 
   * @param dto - Objeto que contiene el tipo de documento, número de documento y contraseña del usuario.
   * @param ipCliente - Dirección IP del cliente que realiza la solicitud de login, utilizada para el control de intentos.
   * @returns - Un objeto que contiene el access token, refresh token y la información del usuario autenticado.
   * @throws - Lanza una excepción UnauthorizedException si las credenciales son inválidas o si el usuario no está activo.
   */
  async execute(dto: LoginDTO, ipCliente = '127.0.0.1') {
    // Verificar si el usuario ha excedido los intentos de login permitidos
    const claveDocumento = `${dto.tipo_documento}:${dto.nro_documento}`;
    await this.controlIntentos?.verificarDisponible('login:doc', claveDocumento);
    await this.controlIntentos?.verificarDisponible('login:ip', ipCliente, 15);

    //Buscar al usuario por nro_documento y tipo_documento, asegurando que esté activo
    const usuario = await this.prisma.usuarios.findFirst({
      where: {
        empleados: {
          nro_documento: dto.nro_documento,
          tipo_documento: { tipo_documento: dto.tipo_documento },
          activo: true,
          deleted_at: null,
        },
        deleted_at: null,
        activo: true,
      },
      include: {
        empleados: {
          select: {
            nombre: true,
            apellido: true,
            nro_documento: true,
            email: true,
          },
        },
      },
    });

    //Validación: Si el usuario no existe, lanzar una excepción UnauthorizedException
    if (!usuario) {
      // AUTH-F4: Mitigación de ataque de temporización ejecutando Argon2 contra hash sintético
      await argon2.verify(DUMMY_ARGON2_HASH, dto.password).catch(() => false);
      await this.controlIntentos?.registrarIntento('login:doc', claveDocumento);
      await this.controlIntentos?.registrarIntento('login:ip', ipCliente);
      throw this.credencialesInvalidas();
    }

    //Verificar la contraseña usando Argon2id
    const isPasswordValid = await argon2.verify(usuario.password_hash, dto.password);
    if (!isPasswordValid) {
      await this.controlIntentos?.registrarIntento('login:doc', claveDocumento);
      await this.controlIntentos?.registrarIntento('login:ip', ipCliente);
      throw this.credencialesInvalidas();
    }
    await this.controlIntentos?.limpiarIntentos('login:doc', claveDocumento);

    const payload = construirPayloadJwt(usuario);
    const accessJti = IdentityGenerator.generateId() || crypto.randomUUID();
    const refreshJti = IdentityGenerator.generateId() || crypto.randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        jwtid: accessJti,
        expiresIn: '15m',
        secret: obtenerSecretoJwt('ACCESS'),
      }),
      this.jwtService.signAsync(payload, {
        jwtid: refreshJti,
        expiresIn: '7d',
        secret: obtenerSecretoJwt('REFRESH'),
      }),
    ]);

    const hashedRT = await argon2.hash(refreshToken, { type: argon2.argon2id });

    // AUTH-F3: Se guarda `id: refreshJti` para que RefrescarTokenUseCase busque directamente por PK en O(1)
    await this.prisma.tokens_seguridad.create({
      data: {
        id: refreshJti,
        usuario_id: usuario.id,
        token_hash: hashedRT,
        proposito: 'REFRESH_TOKEN',
        expira_en: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        usado: false,
      },
    });

    // USR-F1: Registrar la fecha y hora del último acceso exitoso
    if (typeof (this.prisma.usuarios as any)?.update === 'function') {
      await this.prisma.usuarios
        .update({
          where: { id: usuario.id },
          data: { ultimo_acceso: new Date() },
        })
        .catch(() => undefined);
    }

    return {
      accessToken,
      refreshToken,
      usuario: {
        id: usuario.id,
        nombre: payload.nombre,
        email: usuario.email,
        nro_documento: usuario.empleados?.nro_documento,
        rol: usuario.rol,
      },
    };
  }

  //Método privado para lanzar una excepción de credenciales inválidas
  private credencialesInvalidas() {
    return new UnauthorizedException({
      type: 'https://api.jyp.com/errors/invalid-credentials',
      title: 'Acceso Denegado',
      detail: 'El documento o la contraseña son incorrectos.'
    });
  }
}
