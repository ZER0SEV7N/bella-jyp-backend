//src/modules/core/auth/use-cases/recuperacionPassword.useCases.ts
//Caso de uso para la recuperacion de contraseña
//Se encarga de manejar la lógica de negocio relacionada con la recuperación de contraseña,
//incluyendo la generación de tokens de seguridad y el envío de correos electrónicos.
import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '@/common/prisma/prisma.service';
import {SolicitudRecuperacionDTO, RestablecerPasswordDTO} from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { CrearTrabajoIntegracionUseCase } from '@/modules/integraciones/use-cases/crearTrabajoIntegracion.useCase';

/**
 * Caso de uso para la recuperación de contraseña.
 * Este caso de uso maneja la lógica de negocio relacionada con la recuperación de contraseña,
 * incluyendo la generación de tokens de seguridad, la validación de tokens y el restablecimiento
 * de contraseñas. También se encarga de disparar un webhook a n8n para enviar correos electrónicos
 * con instrucciones de recuperación.
 */
@Injectable()
export class RecuperacionPasswordUseCases {
  constructor(private readonly prisma: PrismaService, private readonly integraciones: CrearTrabajoIntegracionUseCase) {}

  /**
   * Solicita la recuperación de contraseña para un usuario.
   * @param dto - DTO que contiene el número de documento del usuario que solicita la recuperación.
   * @returns Un mensaje indicando que se enviarán las instrucciones si el documento es válido.
   */
  async solicitar(dto: SolicitudRecuperacionDTO) {
    //Validar que la URL del frontend y los webhooks de n8n estén configurados
    const frontendUrl = process.env.FRONTEND_RESET_PASSWORD_URL;
    
    //Si no están configurados, lanzar una excepción de servicio no disponible
    if (!frontendUrl || !process.env.N8N_WEBHOOK_URL_TRABAJOS || !process.env.N8N_WEBHOOK_SECRET)
      throw new ServiceUnavailableException('La recuperación por correo todavía no está configurada.');
    
    //Validar que la URL del frontend sea válida y tenga un esquema HTTP o HTTPS
    let uri: URL;

    //Validar que la URL del frontend sea válida y tenga un esquema HTTP o HTTPS
    try { 
      uri = new URL(frontendUrl); 
    } catch { 
      throw new ServiceUnavailableException('Configure una URL válida para restablecer la contraseña.'); 
    }
    
    //Validar que la URL del frontend tenga un esquema HTTP o HTTPS
    if (!['http:', 'https:'].includes(uri.protocol)) 
      throw new ServiceUnavailableException('El enlace de recuperación requiere HTTP o HTTPS.');
    
    //Buscar el usuario activo por su número de documento
    const usuario = await this.prisma.usuarios.findFirst({
      where: { empleados: { nro_documento: dto.nro_documento }, activo: true, deleted_at: null },
      include: { empleados: true },
    });

    //Prevencion de enumeracion de usuarios, no se revela si el usuario existe o no
    if (!usuario) 
      return { message: 'Si el documento es válido, se enviarán las instrucciones.' };
    
    //Regla de negocio: Personal activo sin correo electrónico no puede recuperar contraseña
    if (!usuario.email) throw new BadRequestException({
      type: 'https://api.jyp.com/errors/missing-email', title: 'Correo No Registrado', status: 400,
      detail: 'El usuario no tiene un correo vinculado. Solicite el restablecimiento presencialmente a RRHH.',
    });

    //El token en claro solo se utiliza en el correo; PostgreSQL conserva hash y una solicitud cifrada.
    const plainToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await argon2.hash(plainToken, { type: argon2.argon2id });
    const tokenId = IdentityGenerator.generateId();
    const expiration = new Date(Date.now() + 15 * 60 * 1000);
    
    //Crear el token de seguridad y disparar el webhook a n8n en una transacción atómica
    await this.prisma.$transaction(async (tx) => {
      await tx.tokens_seguridad.updateMany({ where: { usuario_id: usuario.id, proposito: 'RESET_PASSWORD', usado: false }, data: { usado: true } });
      await tx.tokens_seguridad.create({ data: { id: tokenId, usuario_id: usuario.id, token_hash: hashedToken, proposito: 'RESET_PASSWORD', expira_en: expiration } });
      //El token y el trabajo de correo se confirman juntos; n8n puede estar temporalmente detenido.
      await this.integraciones.crearEnTransaccion(tx, `reset:${tokenId}`, 'RESET_PASSWORD', null, usuario.id, [], {
        email: usuario.email, token_recuperacion: `${tokenId}.${plainToken}`, frontend_url: uri.toString(), expira_en: expiration.toISOString(),
      });
    });

    //Prevencion de enumeracion de usuarios, no se revela si el usuario existe o no
    return { message: 'Si el documento es válido, se enviarán las instrucciones.' };
  }

  /**
   * Restablece la contraseña de un usuario utilizando un token de recuperación.
   * @param dto - DTO que contiene el token compuesto y la nueva contraseña.
   * @returns Un mensaje indicando que la contraseña se ha actualizado correctamente.
   * @throws BadRequestException si el token es inválido, ha expirado o si la nueva contraseña es igual a la anterior.
   */
  async restablecer(dto: RestablecerPasswordDTO) {
    //Validar que el token compuesto tenga el formato correcto: {tokenId}.{plainToken}
    const partes = dto.token_compuesto.split('.');
    //Validar que el token tenga exactamente dos partes y que cada parte cumpla con el formato esperado
    const [tokenId, plainToken] = partes;

    //Comprobar que el token tiene el formato correcto y que no haya sido manipulado
    if (partes.length !== 2 || 
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(tokenId) || 
      !/^[a-f0-9]{64}$/.test(plainToken)) 
    throw this.tokenInvalido();

    //Consultar el token en la base de datos y traer el usuario asociado
    const tokenRecord = await this.prisma.tokens_seguridad.findUnique({
      where: { id: tokenId },
      include: { usuarios: true },
    });

    //Validar que el token exista, no haya sido usado y sea del propósito correcto
    if (!tokenRecord || tokenRecord.usado || tokenRecord.proposito !== 'RESET_PASSWORD' || !tokenRecord.usuarios?.activo || tokenRecord.usuarios.deleted_at)
      throw this.tokenInvalido();

    //Validar que el token no haya expirado
    if (new Date() > tokenRecord.expira_en) throw new BadRequestException({
      type: 'https://api.jyp.com/errors/token-expired',
      title: 'Token Expirado',
      detail: 'El enlace de recuperación ha caducado (15 minutos). Solicite uno nuevo.',
    });

    //Validar que el token proporcionado coincida con el hash almacenado
    const isValid = await argon2.verify(tokenRecord.token_hash, plainToken);
    if (!isValid) throw this.tokenInvalido();

    //Regla de negocio: La nueva contraseña debe ser diferente a la anterior
    if (tokenRecord.usuarios.password_hash && await argon2.verify(tokenRecord.usuarios.password_hash, dto.nueva_password))
      throw new BadRequestException('La nueva contraseña debe ser diferente a la anterior.');

    //Generar el hash de la nueva contraseña utilizando Argon2id
    const newPasswordHash = await argon2.hash(dto.nueva_password, { type: argon2.argon2id});

    //Actualizar la contraseña del usuario y marcar el token como usado en una transacción
    await this.prisma.$transaction(async (tx) => {
      // La condición usado=false evita consumir el mismo enlace simultáneamente en dos solicitudes.
      const consumido = await tx.tokens_seguridad.updateMany({
        where: { id: tokenId, usado: false, expira_en: { gt: new Date() } }, data: { usado: true },
      });
      
      //Validar que exactamente un registro haya sido actualizado; si no, el token ya fue consumido o expiró
      if (consumido.count !== 1) 
        throw this.tokenInvalido();

      //Actualizar la contraseña del usuario y marcar el token como usado
      await tx.usuarios.update({ where: { id: tokenRecord.usuario_id }, data: { password_hash: newPasswordHash } });
      await tx.tokens_seguridad.updateMany({ where: { usuario_id: tokenRecord.usuario_id, proposito: 'REFRESH_TOKEN', usado: false }, data: { usado: true } });
    });

    return { message: 'Contraseña actualizada correctamente.' };
  }

  /**
   * Método privado para generar una excepción de token inválido.
   * Se utiliza cuando el token de recuperación es inválido, ya fue usado o está malformado.
   * @returns BadRequestException con detalles del error.
   */
  private tokenInvalido() {
    return new BadRequestException({
      type: 'https://api.jyp.com/errors/invalid-token',
      title: 'Token Inválido',
      detail: 'El token de recuperación es inválido, ya fue usado o está malformado.',
    });
  }
}
