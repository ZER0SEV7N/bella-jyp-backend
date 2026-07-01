//src/modules/auth/services/auth.service.ts
//Servicio de autenticación para manejar la lógica de negocio relacionada con la autenticación
import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '@/common/prisma/prisma.service';
import { LoginDTO, ProvisionarUsuarioDTO, SolicitudRecuperacionDTO } from ' @jyp/shared-contracts';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) {}

    //Metodo para crear un nuevo usuario, se utiliza para provisionar usuarios desde el panel de administración
    async crearUsuarioInterno(dto: ProvisionarUsuarioDTO) {
        const tipoDoc = await this.prisma.tipo_documento.findFirst({
            where: { tipo_documento: dto.tipo_documento },
        });

        if(!tipoDoc) throw new NotFoundException({
            type: 'https://api.jyp.com/errors/not-found',
            title: 'Tipo de Documento Inexistente',
            detail: `El documento ${dto.tipo_documento} no está configurado en el sistema.`,
        });

        const existe = await this.prisma.usuario.findFirst({
            where: { 
                nro_documento: dto.nro_documento,
                tipo_documento_id: tipoDoc.id,
             },
        });

        if(existe) throw new ConflictException({
            type: 'https://api.jyp.com/errors/conflict',
            title: 'Usuario Existente',
            detail: `El usuario con documento ${dto.tipo_documento} ${dto.nro_documento} ya existe.`,
        });
    
        const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

        return await this.prisma.usuario.create({
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

    //Metodo para autenticar un usuario, se utiliza para el login
    async autenticar(dto: LoginDTO) {
        const usuario = await this.prisma.usuario.findFirst({
            where: { 
                nro_documento: dto.nro_documento,
                tipo_documento_rel: { tipo_documento: dto.tipo_documento }
            },
            include: { tipo_documento_rel: true }
        });

        if (!usuario || !usuario.activo) throw this.credencialesInvalidas();

        const isPasswordValid = await argon2.verify(usuario.password_hash, dto.password);
        if(!isPasswordValid) throw this.credencialesInvalidas();

        const payload = {
            sub: usuario.id,
            rol: usuario.rol,
            doc: usuario.nro_documento,
            empId: usuario.empleado_id,
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, { expiresIn: '15m' }),
            this.jwtService.signAsync(payload, { expiresIn: '7d', secret: process.env.JWT_REFRESH_SECRET }),
        ]);

        const hashedRT = await argon2.hash(refreshToken);

        await this.prisma.usuario.update({
            where: { id: usuario.id },
            data: { hashed_refresh_token: hashedRT },
        });

        return {
            accessToken: accessToken,
            refreshToken: refreshToken,
            usuario: { id: usuario.id, nro_documento: usuario.nro_documento, rol: usuario.rol },
        }
    }

    //Metodo privado para validar credenciales inválidas, lanza una excepción personalizada
    private credencialesInvalidas() {
        return new UnauthorizedException({
            type: 'https://api.jyp.com/errors/invalid-credentials',
            title: 'Acceso Denegado',
            detail: 'El documento o la contraseña son incorrectos.',
        });
    }        


}