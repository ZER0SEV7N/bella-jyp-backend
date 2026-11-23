//src/modules/core/auth/use-cases/recuperacionPassword.useCases.ts
//Caso de uso para la recuperacion de contraseña
//Se encarga de manejar la lógica de negocio relacionada con la recuperación de contraseña,
//incluyendo la generación de tokens de seguridad y el envío de correos electrónicos.
import { Injectable, BadRequestException, ServiceUnavailableException, Optional, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '@/common/prisma/prisma.service';
import {SolicitudRecuperacionDTO, RestablecerPasswordDTO} from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { CrearTrabajoIntegracionUseCase } from '@/modules/integraciones/use-cases/crearTrabajoIntegracion.useCase';
import { ControlIntentosService } from '@/common/guards/control-intentos.service';

const MENSAJE_UNIFORME_RECUPERACION = 'Si el documento es válido, se enviarán las instrucciones.';

/**
 * Caso de uso para la recuperación de contraseña.
 * Este caso de uso maneja la lógica de negocio relacionada con la recuperación de contraseña,
 * incluyendo la generación de tokens de seguridad, la validación de tokens y el restablecimiento
 * de contraseñas. También se encarga de disparar un webhook a n8n para enviar correos electrónicos
 * con instrucciones de recuperación.
 */
@Injectable()
export class RecuperacionPasswordUseCases {
  private readonly logger = new Logger(RecuperacionPasswordUseCases.name);
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly integraciones: CrearTrabajoIntegracionUseCase,
    @Optional() private readonly controlIntentos?: ControlIntentosService,
  ) {}

  /**
   * Solicita la recuperación de contraseña para un usuario.
   * @param dto - DTO que contiene el número de documento del usuario que solicita la recuperación.
   * @returns Un mensaje indicando que se enviarán las instrucciones si el documento es válido.
   */
  async solicitar(dto: SolicitudRecuperacionDTO, ipCliente = '127.0.0.1') {
    //Registrar intentos de recuperación para prevenir abuso y enumeración de usuarios
    await this.controlIntentos?.verificarDisponible('recuperar:doc', dto.nro_documento);
    await this.controlIntentos?.verificarDisponible('recuperar:ip', ipCliente, 10);
    await this.controlIntentos?.registrarIntento('recuperar:doc', dto.nro_documento);
    await this.controlIntentos?.registrarIntento('recuperar:ip', ipCliente);

    //Validar que la URL del frontend y los webhooks de n8n estén configurados
    const frontendUrl = process.env.FRONTEND_RESET_PASSWORD_URL;
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
      where: {
        empleados: { nro_documento: dto.nro_documento, activo: true, deleted_at: null },
        activo: true,
        deleted_at: null,
      },
      include: { empleados: true },
    });

    //Prevencion de enumeracion de usuarios, no se revela si el usuario existe o no
    if (!usuario) 
      return { message: MENSAJE_UNIFORME_RECUPERACION };
    
    //Validar que el usuario tenga un correo electrónico registrado antes de generar el token de recuperación
    if (!usuario.email) {
      this.logger.warn(`Intento de recuperación para usuario activo sin correo registrado (ID: ${usuario.id}).`);
      return { message: MENSAJE_UNIFORME_RECUPERACION };
    }

    //El token en claro solo se utiliza en el correo; PostgreSQL conserva hash y una solicitud cifrada.
    const plainToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await argon2.hash(plainToken, { type: argon2.argon2id });
    const tokenId = IdentityGenerator.generateId();
    const expiration = new Date(Date.now() + 15 * 60 * 1000);
    
    //Crear el token de seguridad y disparar el webhook a n8n en una transacción atómica
    await this.prisma.$transaction(async (tx) => {
      await tx.tokens_seguridad.updateMany({
        where: { usuario_id: usuario.id, proposito: 'RESET_PASSWORD', usado: false },
        data: { usado: true },
      });
      await tx.tokens_seguridad.create({
        data: {
          id: tokenId,
          usuario_id: usuario.id,
          token_hash: hashedToken,
          proposito: 'RESET_PASSWORD',
          expira_en: expiration,
        },
      });
      await this.integraciones.crearEnTransaccion(
        tx,
        `reset:${tokenId}`,
        'RESET_PASSWORD',
        null,
        usuario.id,
        [],
        {
          email: usuario.email,
          token_recuperacion: `${tokenId}.${plainToken}`,
          frontend_url: uri.toString(),
          expira_en: expiration.toISOString(),
        },
      );
    });

    return { message: MENSAJE_UNIFORME_RECUPERACION };
  }

  /**
   * Restablece la contraseña de un usuario utilizando un token de recuperación.
   * @param dto - DTO que contiene el token compuesto y la nueva contraseña.
   * @returns Un mensaje indicando que la contraseña se ha actualizado correctamente.
   * @throws BadRequestException si el token es inválido, ha expirado o si la nueva contraseña es igual a la anterior.
   */
  async restablecer(dto: RestablecerPasswordDTO, ipCliente = '127.0.0.1') {
    await this.controlIntentos?.verificarDisponible('restablecer:ip', ipCliente, 10);

    // Validar el formato del token compuesto y extraer el ID del token y el token en claro
    const partes = dto.token_compuesto.split('.');
    const [tokenId, plainToken] = partes;

    // Validar que el token tenga exactamente dos partes y que ambas partes tengan el formato esperado
    if ( partes.length !== 2 || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(tokenId) || !/^[a-f0-9]{64}$/.test(plainToken)) {
      await this.controlIntentos?.registrarIntento('restablecer:ip', ipCliente);
      throw this.tokenInvalido();
    }

    // Buscar el token de seguridad en la base de datos y verificar su validez
    const tokenRecord = await this.prisma.tokens_seguridad.findUnique({
      where: { id: tokenId },
      include: { usuarios: true },
    });

    if ( !tokenRecord || tokenRecord.usado || tokenRecord.proposito !== 'RESET_PASSWORD' || !tokenRecord.usuarios?.activo || tokenRecord.usuarios.deleted_at ) {
      await this.controlIntentos?.registrarIntento('restablecer:ip', ipCliente);
      throw this.tokenInvalido();
    }

    if (new Date() > tokenRecord.expira_en) throw new BadRequestException({
      type: 'https://api.jyp.com/errors/token-expired',
      title: 'Token Expirado',
      detail: 'El enlace de recuperación ha caducado (15 minutos). Solicite uno nuevo.',
    });
    
    const isValid = await argon2.verify(tokenRecord.token_hash, plainToken);
    if (!isValid) {
      await this.controlIntentos?.registrarIntento('restablecer:ip', ipCliente);
      throw this.tokenInvalido();
    }

    if (tokenRecord.usuarios.password_hash && (await argon2.verify(tokenRecord.usuarios.password_hash, dto.nueva_password))) 
      throw new BadRequestException('La nueva contraseña debe ser diferente a la anterior.');
    

    const newPasswordHash = await argon2.hash(dto.nueva_password, { type: argon2.argon2id });

    await this.prisma.$transaction(async (tx) => {
      const consumido = await tx.tokens_seguridad.updateMany({
        where: { id: tokenId, usado: false, expira_en: { gt: new Date() } },
        data: { usado: true },
      });

      if (consumido.count !== 1) 
        throw this.tokenInvalido();

      // Actualizar la contraseña del usuario y marcar todos los tokens de recuperación como usados
      await tx.usuarios.update({
        where: { id: tokenRecord.usuario_id },
        data: { password_hash: newPasswordHash },
      });

      // Marcar todos los tokens de recuperación como usados para evitar reutilización
      await tx.tokens_seguridad.updateMany({
        where: { usuario_id: tokenRecord.usuario_id, proposito: 'REFRESH_TOKEN', usado: false },
        data: { usado: true },
      });
    });

    await this.controlIntentos?.limpiarIntentos('restablecer:ip', ipCliente);
    return { message: 'Contraseña actualizada correctamente.' };
  }

  private tokenInvalido() {
    return new BadRequestException({
      type: 'https://api.jyp.com/errors/invalid-token',
      title: 'Token Inválido',
      detail: 'El token de recuperación es inválido, ya fue usado o está malformado.',
    });
  }
}