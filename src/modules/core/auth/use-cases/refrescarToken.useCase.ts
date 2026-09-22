//src/modules/core/auth/use-cases/refrescarToken.useCase.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Interfaz que define la estructura del resultado devuelto por el caso de uso RefrescarTokenUseCase.
 * Contiene el nuevo Access Token y el nuevo Refresh Token generados tras la rotación de tokens.
 * Se utiliza para garantizar que la respuesta del caso de uso tenga un formato consistente y tipado.
 */
export interface ResultadoRefrescarToken {
  accessToken: string;
  newRefreshToken: string;
}

/**
 * Caso de uso que maneja la lógica de refresco de tokens de autenticación.
 * Este caso de uso realiza las siguientes operaciones:
 * 1. Verifica la validez del Refresh Token proporcionado.
 * 2. Valida la existencia y vigencia del usuario asociado al token.
 * 3. Verifica que el Refresh Token no haya sido revocado o usado previamente.
 * 4. Emite un nuevo Access Token y un nuevo Refresh Token.
 */
@Injectable()
export class RefrescarTokenUseCase {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Metodo principal que ejecuta la lógica de refresco de tokens.
   * @param refreshToken El Refresh Token proporcionado por el cliente para obtener nuevos tokens.
   * @throws UnauthorizedException si el Refresh Token es inválido, expirado, revocado o si el usuario no es válido.
   * @returns Un objeto que contiene el nuevo Access Token y el nuevo Refresh Token.
   */
  async execute(refreshToken: string): Promise<ResultadoRefrescarToken> {
    if (!refreshToken) throw new UnauthorizedException('Refresh token no proporcionado.');
    
    let payload: any; //Variable para almacenar el payload decodificado del Refresh Token
    try {
      //Decodificar y verificar el Refresh Token usando la clave secreta correspondiente
      payload = this.jwtService.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET || 'jyp-dev-refresh-secret-1234' });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado.');
    }

    //Validar que el usuario asociado al token exista y esté activo
    const userId = payload.sub || payload.id;

    //Buscar el usuario en la base de datos usando Prisma
    const user = await this.prisma.usuarios.findUnique({
      where: { id: userId },
      include: {
        empleados: {
          select: {
            nombre: true,
            apellido: true,
            nro_documento: true
          }
        }
      }
    });

    // Validar que el usuario exista y esté activo
    if (!user?.activo || user.deleted_at !== null) throw new UnauthorizedException('Usuario no encontrado o inactivo.');
    

    //Validar que el Refresh Token no haya sido revocado o usado previamente
    const tokenActivo = await this.prisma.tokens_seguridad.findFirst({
      where: {
        usuario_id: user.id,
        proposito: 'REFRESH_TOKEN',
        usado: false,
        expira_en: { gt: new Date() }
      }
    });

    //Si no se encuentra un token activo, significa que el Refresh Token ha sido revocado o usado previamente
    if (!tokenActivo) throw new UnauthorizedException('Sesión cerrada o token revocado.');
    
    //Obtener el nombre completo del usuario a partir de los datos del empleado, si están disponibles
    const nombreCompleto = user.empleados ? `${user.empleados.nombre ?? ''} ${user.empleados.apellido ?? ''}`.trim() : 'Usuario del Sistema';

    const nuevoPayload = {
      sub: user.id,
      email: user.email,
      roles: user.rol,
      doc: payload.doc || user.empleado_id,
      empId: user.empleado_id,
      nombre: nombreCompleto
    };

    // 3. Emisión dual de tokens
    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.jwtService.signAsync(nuevoPayload, {
        secret: process.env.JWT_ACCESS_SECRET || 'jyp-dev-secret-key-1234',
        expiresIn: '15m'
      }),
      this.jwtService.signAsync(nuevoPayload, {
        secret: process.env.JWT_REFRESH_SECRET || 'jyp-dev-refresh-secret-1234',
        expiresIn: '7d'
      })
    ]);

    //Rotar el Refresh Token: marcar el token actual como usado y crear un nuevo registro de token en la base de datos
    const hashedRT = await argon2.hash(newRefreshToken, { type: argon2.argon2id });

    await this.prisma.$transaction([
      this.prisma.tokens_seguridad.update({
        where: { id: tokenActivo.id },
        data: { usado: true }
      }),
      this.prisma.tokens_seguridad.create({
        data: {
          id: crypto.randomUUID(),
          usuario_id: user.id,
          token_hash: hashedRT,
          proposito: 'REFRESH_TOKEN',
          expira_en: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          usado: false
        }
      })
    ]);

    return {
      accessToken: newAccessToken,
      newRefreshToken
    };
  }
}