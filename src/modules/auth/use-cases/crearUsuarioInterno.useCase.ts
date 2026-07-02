import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ProvisionarUsuarioDTO } from '@jyp/shared-contracts';

@Injectable()
export class ProvisionarUsuarioUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ProvisionarUsuarioDTO) {
    const tipoDoc = await this.prisma.tipo_documento.findFirst({
      where: { tipo_documento: dto.tipo_documento },
    });

    if (!tipoDoc) {
      throw new NotFoundException({
        type: 'https://api.jyp.com/errors/not-found',
        title: 'Tipo de Documento Inexistente',
        detail: `El documento ${dto.tipo_documento} no está configurado en el sistema.`,
      });
    }

    const existe = await this.prisma.usuarios.findFirst({
      where: { 
        nro_documento: dto.nro_documento,
        documento_id: tipoDoc.id, // Asegúrate de que este ID coincida con tu Prisma Client
      },
    });

    if (existe) {
      throw new ConflictException({
        type: 'https://api.jyp.com/errors/conflict',
        title: 'Usuario Existente',
        detail: `El usuario con documento ${dto.tipo_documento} ${dto.nro_documento} ya existe.`,
      });
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    return await this.prisma.usuarios.create({
      data: {
        documento_id: tipoDoc.id,
        nro_documento: dto.nro_documento,
        email: dto.email || null,
        password_hash: passwordHash,
        rol: dto.rol,
        empleado_id: dto.empleado_id || null,
      },
      select: { id: true, rol: true, nro_documento: true }
    });
  }
}