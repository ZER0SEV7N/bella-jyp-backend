//src/modules/auth/use-cases/login.useCase.ts
//Caso de uso para el login de usuarios internos
//Se encarga de autenticar a un usuario interno y generar tokens JWT
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '@/common/prisma/prisma.service';
import { LoginDTO } from '@jyp/shared-contracts';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  //Metodo principal para ejecutar el caso de uso
  async execute(dto: LoginDTO) {
    //Buscar al usuario por nro_documento y tipo_documento, asegurando que esté activo
    const usuario = await this.prisma.usuarios.findFirst({
      where: {
        empleados: { nro_documento: dto.nro_documento,
          tipo_documento: { tipo_documento: dto.tipo_documento },
        },
        activo: true, //Condición de seguridad a nivel de tabla auth
      },
      include: { empleados: true }, //Traemos al empleado para armar el Payload
    });

    //Validación: Si el usuario no existe, lanzar una excepción UnauthorizedException
    if (!usuario) throw this.credencialesInvalidas();

    //Verificar la contraseña usando Argon2id
    const isPasswordValid = await argon2.verify(
      usuario.password_hash,
      dto.password,
    );
    if (!isPasswordValid) throw this.credencialesInvalidas();

    //Construcción del Payload del Token (Asimétrico)
    const payload = {
      sub: usuario.id,
      rol: usuario.rol,
      doc: usuario.empleados?.nro_documento,
      empId: usuario.empleado_id,
    };

    //Firma en paralelo (Protegiendo el Event Loop)
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      this.jwtService.signAsync(payload, {
        expiresIn: '7d',
        secret: process.env.JWT_REFRESH_SECRET,
      }),
    ]);

    //Persistencia de Sesión (En tu tabla satélite)
    const hashedRT = await argon2.hash(refreshToken, { type: argon2.argon2id });

    await this.prisma.tokens_seguridad.create({
      data: {
        id: crypto.randomUUID(), //UUIDv7 si tienes tu IdentityGenerator, sino randomUUID nativo
        usuario_id: usuario.id,
        token_hash: hashedRT,
        proposito: 'REFRESH_TOKEN',
        expira_en: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 días
      },
    });

    //Retorno Estricto
    return {
      accessToken,
      refreshToken,
      usuario: {
        id: usuario.id,
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
      detail: 'El documento o la contraseña son incorrectos.',
    });
  }
}
