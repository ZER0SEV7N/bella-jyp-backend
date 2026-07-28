//src/modules/auth/strategies/jwt.strategy.ts
//Strategy para validar el token JWT
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

//estrategia JWT
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      //Extrae el token del header Authorization
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      //Ignores la expiración del token, se puede configurar para que no lo haga
      ignoreExpiration: false,
      //Clave secreta para validar el token, se obtiene del archivo de configuración
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'jyp-dev-secret-key-1234',
    });
  }

  //Metodo para validar el token, se ejecuta cada vez que se hace una petición con un token válido
  async validate(payload: any) {
    if (!payload.sub) throw new UnauthorizedException('Token inválido');

    return {
      id: payload.sub,
      rol: payload.rol,
      nro_documeto: payload.doc,
      empleado_id: payload.empId,
    };
  }
}
