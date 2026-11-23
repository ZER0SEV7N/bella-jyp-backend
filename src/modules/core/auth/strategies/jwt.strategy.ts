//src/modules/core/auth/strategies/jwt.strategy.ts
//Strategy para validar el token JWT
import { CLS_IP_ADDRESS, CLS_USER_ID } from '@/common/cls/cls.constants';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ClsService } from 'nestjs-cls';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { obtenerSecretoJwt } from '../helpers/auth-token.helper';

/**
 * Estrategia de autenticación JWT para validar tokens de acceso.
 * Esta estrategia se encarga de verificar la validez del token JWT proporcionado por el cliente,
 * asegurando que el usuario asociado al token esté activo y no haya sido eliminado.
 * Además, inyecta información de auditoría en el contexto de la solicitud para su posterior uso.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {
    super({
      //Extrae el token del header Authorization
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      //Ignores la expiración del token, se puede configurar para que no lo haga
      ignoreExpiration: false,
      //Clave secreta para validar el token, se obtiene del archivo de configuración
      secretOrKey: obtenerSecretoJwt('ACCESS'),
      passReqToCallback: true
    });
  }

  //Metodo para validar el token, se ejecuta cada vez que se hace una petición con un token válido
  async validate(req: any, payload: any) {
    // Obtiene el ID del usuario desde el payload del token
    const userId = payload.sub || payload.id;

    const user = await this.prisma.usuarios.findUnique({
      where: { id: userId },
      include: {
        empleados: {
          select: {
            activo: true,
            deleted_at: true,
            estado_laboral: true,
          },
        },
      },
    });

    if (!user?.activo || user.deleted_at !== null) {
      throw new UnauthorizedException('Su acceso ha sido revocado o la cuenta ya no existe.');
    }

    // EMP-F3: Si el empleado asociado fue cesado o despedido, se revoca el acceso inmediatamente
    if (user.empleados && (user.empleados.activo === false || user.empleados.deleted_at !== null || ['CESADO', 'DESPEDIDO'].includes(user.empleados.estado_laboral ?? ''))) 
      throw new UnauthorizedException('El vínculo laboral del colaborador ya no se encuentra activo.');
    
    // Inyecta información de auditoría en el contexto de la solicitud para su posterior uso
    this.cls.set(CLS_USER_ID, user.id);
    this.cls.set(CLS_IP_ADDRESS, req.ip || req.socket?.remoteAddress || '127.0.0.1');

    return {
      id: user.id,
      rol: user.rol,
      empleado_id: user.empleado_id,
    };
  }
}