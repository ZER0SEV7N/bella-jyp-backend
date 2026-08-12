//src/modules/core/auth/use-cases/recuperacionPassword.useCases.ts
//Caso de uso para la recuperacion de contraseña
//Se encarga de manejar la lógica de negocio relacionada con la recuperación de contraseña,
//incluyendo la generación de tokens de seguridad y el envío de correos electrónicos.
import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  SolicitudRecuperacionDTO,
  RestablecerPasswordDTO,
} from '@jyp/shared-contracts';
import axios from 'axios';

@Injectable()
export class RecuperacionPasswordUseCases {
  constructor(private readonly prisma: PrismaService) {}

  //Metodo para solicitar la recuperacion de contraseña,
  //genera un token de seguridad y lo almacena en la base de datos
  async solicitar(dto: SolicitudRecuperacionDTO) {
    const usuario = await this.prisma.usuarios.findFirst({
      where: {
        empleados: { nro_documento: dto.nro_documento },
        activo: true,
      },
      include: { empleados: true },
    });

    //Prevencion de enumeracion de usuarios, no se revela si el usuario existe o no
    if (!usuario)
      return {
        message: 'Si el documento es válido, se enviarán las instrucciones.',
      };

    //Regla de negocio: Personal activo sin correo electrónico no puede recuperar contraseña
    if (!usuario.email)
      throw new BadRequestException({
        type: 'https://api.jyp.com/errors/missing-email',
        title: 'Correo No Registrado',
        status: 400,
        detail:
          'El usuario no tiene un correo vinculado. Solicite el restablecimiento presencialmente a RRHH.',
      });

    //Generar el token criptografico
    const plainToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await argon2.hash(plainToken);
    const expiration = new Date(Date.now() + 15 * 60 * 1000); //15 * 60 * 1000 = 15 minutos

    const tokenRecord = await this.prisma.tokens_seguridad.create({
      data: {
        id: crypto.randomUUID(),
        usuario_id: usuario.id,
        token_hash: hashedToken,
        proposito: 'RESET_PASSWORD',
        expira_en: expiration,
      },
    });

    //Token compuesto para enviar al usuario:
    const tokenCompuesto = `${tokenRecord.id}.${plainToken}`;

    this.dispararWebhookN8n(usuario.email, tokenCompuesto);

    return {
      message: 'Si el documento es válido, se enviarán las instrucciones.',
    };
  }

  //Metodo para restablecer la contraseña usando el token de seguridad
  async restablecer(dto: RestablecerPasswordDTO) {
    const [tokenId, plainToken] = dto.token_compuesto.split('.');

    //Consultar el token en la base de datos y traer el usuario asociado
    const tokenRecord = await this.prisma.tokens_seguridad.findUnique({
      where: { id: tokenId },
      include: { usuarios: true },
    });

    //Validar que el token exista, no haya sido usado y sea del propósito correcto
    if (
      !tokenRecord ||
      tokenRecord.usado ||
      tokenRecord.proposito !== 'RESET_PASSWORD'
    )
      throw this.tokenInvalido();

    //Validar que el token no haya expirado
    if (new Date() > tokenRecord.expira_en)
      throw new BadRequestException({
        type: 'https://api.jyp.com/errors/token-expired',
        title: 'Token Expirado',
        detail:
          'El enlace de recuperación ha caducado (15 minutos). Solicite uno nuevo.',
      });

    //Validar que el token proporcionado coincida con el hash almacenado
    const isValid = await argon2.verify(tokenRecord.token_hash, plainToken);
    if (!isValid) throw this.tokenInvalido();

    //Regla de negocio: La nueva contraseña debe ser diferente a la anterior
    const newPasswordHash = await argon2.hash(dto.nueva_password, {
      type: argon2.argon2id,
    });

    //Actualizar la contraseña del usuario y marcar el token como usado en una transacción
    await this.prisma.$transaction([
      this.prisma.tokens_seguridad.update({
        where: { id: tokenId },
        data: { usado: true },
      }),
      this.prisma.usuarios.update({
        where: { id: tokenRecord.usuario_id },
        data: { password_hash: newPasswordHash },
      }),
      this.prisma.tokens_seguridad.updateMany({
        where: {
          usuario_id: tokenRecord.usuario_id,
          proposito: 'REFRESH_TOKEN',
          usado: false,
        },
        data: { usado: true },
      }),
    ]);

    return { message: 'Contraseña actualizada correctamente.' };
  }

  private tokenInvalido() {
    return new BadRequestException({
      type: 'https://api.jyp.com/errors/invalid-token',
      title: 'Token Inválido',
      detail:
        'El token de recuperación es inválido, ya fue usado o está malformado.',
    });
  }

  //Metodo privado para disparar un webhook a n8n, que se encargará de enviar el correo electrónico
  private dispararWebhookN8n(email: string, token: string) {
    const payload = JSON.stringify({ email, token_recuperacion: token });

    //Firma Criptografica HMAC-SHA256 para validar la integridad del payload
    const signature = crypto
      .createHmac(
        'sha256',
        process.env.N8N_WEBHOOK_SECRET || 'SECRET_TEMPORAL_DEV',
      )
      .update(payload)
      .digest('hex');

    //URL del webhook de n8n, debe estar configurada en las variables de entorno
    const webHookUrl = process.env.N8N_WEBHOOK_URL_RESET_PASSWORD;
    if (!webHookUrl)
      throw new Error(
        'N8N_WEBHOOK_URL_RESET_PASSWORD no está configurado en las variables de entorno.',
      );

    //Disparo del webhook a n8n con el payload y la firma en los headers
    axios
      .post(webHookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
        },
      })
      .catch((error) => {
        console.error('Error al disparar el webhook a n8n:', error.message);
      });
  }
}
