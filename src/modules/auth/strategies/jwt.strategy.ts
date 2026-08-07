//src/modules/auth/strategies/jwt.strategy.ts
//Strategy para validar el token JWT
import { CLS_IP_ADDRESS, CLS_USER_ID } from '@/common/cls/cls.constants';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ClsService } from 'nestjs-cls';
import { ExtractJwt, Strategy } from 'passport-jwt';

//estrategia JWT
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
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'jyp-dev-secret-key-1234',
      passReqToCallback: true,
    });
  }

  //Metodo para validar el token, se ejecuta cada vez que se hace una petición con un token válido
  async validate(req: any, payload: any) {
    const userId = payload.sub || payload.id;

    const user = await this.prisma.usuarios.findUnique({ where: { id: userId } });

    if (!user || !user.activo || user.deleted_at !== null) throw new UnauthorizedException( 'Su acceso ha sido revocado o la cuenta ya no existe.' );
    

    // ---------------------------------------------------------
    // EL PUENTE MÁGICO: Guardamos el ID y la IP en el contexto
    // para que PrismaService los lea al auditar.
    // ---------------------------------------------------------
    this.cls.set(CLS_USER_ID, user.id);
    this.cls.set(CLS_IP_ADDRESS, req.ip || req.socket?.remoteAddress || '127.0.0.1',);

    return {
      id: user.id,
      rol: user.rol,
      empleado_id: user.empleado_id,
    };
  }
}