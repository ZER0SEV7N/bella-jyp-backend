//src/modules/core/auth/use-cases/refrescarToken.useCase.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { PrismaService } from '@/common/prisma/prisma.service';
import { construirPayloadJwt, obtenerSecretoJwt } from '../helpers/auth-token.helper';
import { IdentityGenerator } from '@/common/utils/uuid.util';

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
    private readonly prisma: PrismaService
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
      payload = this.jwtService.verify(refreshToken, {
        secret: obtenerSecretoJwt('REFRESH'),
      });
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
            nro_documento: true,
            activo: true,
            deleted_at: true
          },
        },
      },
    });

    // Validar que el usuario exista y esté activo
    if ( !user?.activo || user.deleted_at !== null ||(user.empleados && (user.empleados.activo === false || user.empleados.deleted_at !== null))) 
      throw new UnauthorizedException('Usuario no encontrado o inactivo.');
    
    // Localizar el Refresh Token activo en la base de datos para verificar que no haya sido revocado o usado
    const tokenActivo = await this.localizarTokenActivo(user.id, payload.jti, refreshToken);
    if (!tokenActivo) 
      throw new UnauthorizedException('Sesión cerrada o token revocado.');
    

    // Construir el nuevo payload para los tokens JWT
    const nuevoPayload = construirPayloadJwt(user);
    const nuevoAccessJti = IdentityGenerator.generateId() || crypto.randomUUID();
    const nuevoRefreshJti = IdentityGenerator.generateId() || crypto.randomUUID();

    // Generar nuevos tokens JWT (Access y Refresh) de forma concurrente para optimizar el tiempo de respuesta
    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.jwtService.signAsync(nuevoPayload, {
        jwtid: nuevoAccessJti,
        secret: obtenerSecretoJwt('ACCESS'),
        expiresIn: '15m',
      }),

      this.jwtService.signAsync(nuevoPayload, {
        jwtid: nuevoRefreshJti,
        secret: obtenerSecretoJwt('REFRESH'),
        expiresIn: '7d',
      }),
    ]);

    const hashedRT = await argon2.hash(newRefreshToken, { type: argon2.argon2id });

    await this.prisma.$transaction(async (tx) => {
      const consumido = await tx.tokens_seguridad.updateMany({
        where: { id: tokenActivo.id, usado: false, expira_en: { gt: new Date() } },
        data: { usado: true },
      });

      if (consumido.count !== 1) 
        throw new UnauthorizedException('El refresh token ya fue utilizado.');
      

      await tx.tokens_seguridad.create({
        data: {
          id: nuevoRefreshJti,
          usuario_id: user.id,
          token_hash: hashedRT,
          proposito: 'REFRESH_TOKEN',
          expira_en: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          usado: false,
        },
      });
    });

    return {
      accessToken: newAccessToken,
      newRefreshToken,
    };
  }

  /**
   * Metodo privado que localiza un Refresh Token activo en la base de datos.
   * @param usuarioId El ID del usuario asociado al token.
   * @param jti El JWT ID del Refresh Token, si está disponible.
   * @param refreshToken El Refresh Token proporcionado por el cliente.
   * @returns El token activo encontrado o undefined si no se encuentra ninguno válido.
   */
  private async localizarTokenActivo( usuarioId: string, jti: string | undefined, refreshToken: string ): Promise<{ id: string; token_hash: string } | undefined> {
    // Si se proporciona un `jti` y la función `findUnique` está disponible, buscar directamente por `jti`
    if (jti && typeof (this.prisma.tokens_seguridad as any)?.findUnique === 'function') {
      const directo = await this.prisma.tokens_seguridad.findUnique({where: { id: jti } });
      
      // Validar que el token encontrado coincida con el usuario, propósito y hash del refresh token
      if ( directo?.usuario_id === usuarioId && directo.proposito === 'REFRESH_TOKEN' && !directo.usado && directo.expira_en > new Date() &&
       (await argon2.verify(directo.token_hash, refreshToken))) 
        return directo;
      
    }

    // Si no se encuentra por `jti`, buscar todos los tokens activos del usuario y verificar el hash
    if (typeof (this.prisma.tokens_seguridad as any)?.findMany === 'function') {
      const tokensActivos = await this.prisma.tokens_seguridad.findMany({
        where: {
          usuario_id: usuarioId,
          proposito: 'REFRESH_TOKEN',
          usado: false,
          expira_en: { gt: new Date() }
        },
      });

      // Verificar cada token activo para encontrar uno que coincida con el hash del refresh token proporcionado
      for (const candidato of tokensActivos) {
        if (await argon2.verify(candidato.token_hash, refreshToken)) 
          return candidato;
      }
    }

    return undefined;
  }
}
