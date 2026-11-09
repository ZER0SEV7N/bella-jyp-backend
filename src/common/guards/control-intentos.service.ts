//src/common/guards/control-intentos.service.ts
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../cls/redis.constants';

/**
 * Servicio transversal de limitación de intentos fallidos y prevención de fuerza bruta respaldado en Redis (AUTH-F2).
 * Se aplica en:
 * - Inicio de sesión (`POST /api/v1/auth/login`)
 * - Solicitud y restablecimiento de contraseña (`POST /api/v1/auth/recuperar-password`, `POST /api/v1/auth/restablecer-password`)
 * - Confirmación con contraseña al editar datos financieros (`PUT /api/v1/rrhh/dato-financiero/empleado/:id`)
 */
@Injectable()
export class ControlIntentosService {
  private static readonly MAX_INTENTOS_DEFECTO = 5;
  private static readonly VENTANA_SEGUNDOS_DEFECTO = 15 * 60; // 15 minutos

  constructor(@Inject(REDIS_CLIENT) private readonly redis?: Redis) {}

  /**
   * Verifica si la clave (`accion:identificador`) ha superado el umbral de intentos permitidos.
   * @throws HttpException (429 Too Many Requests) cuando se excede el límite.
   */
  async verificarDisponible(accion: string, identificador: string, maxIntentos = ControlIntentosService.MAX_INTENTOS_DEFECTO ): Promise<void> {
    if (!this.redis || typeof this.redis.get !== 'function') return;

    const clave = this.construirClave(accion, identificador);
    const actual = Number((await this.redis.get(clave)) ?? '0');

    if (actual >= maxIntentos) throw new HttpException({
      type: 'https://api.jyp.com/errors/too-many-requests',
      title: 'Demasiados Intentos',
      status: HttpStatus.TOO_MANY_REQUESTS,
      detail: 'Se ha superado el límite de intentos permitidos. Espere 15 minutos antes de volver a intentarlo.',
    }, HttpStatus.TOO_MANY_REQUESTS );
    
  }

  /**
   * Registra un intento fallido o una solicitud sensible en la ventana de tiempo indicada.
   */
  async registrarIntento(accion: string, identificador: string, ventanaSegundos = ControlIntentosService.VENTANA_SEGUNDOS_DEFECTO): Promise<number> {
    if (!this.redis || typeof this.redis.incr !== 'function') return 0;

    const clave = this.construirClave(accion, identificador);
    const conteo = await this.redis.incr(clave);
    if (conteo === 1 && typeof this.redis.expire === 'function') {
      await this.redis.expire(clave, ventanaSegundos);
    }
    return conteo;
  }

  /**
   * Limpia el contador de intentos fallidos tras una autenticación o validación exitosa.
   */
  async limpiarIntentos(accion: string, identificador: string): Promise<void> {
    if (!this.redis || typeof this.redis.del !== 'function') return;
    await this.redis.del(this.construirClave(accion, identificador));
  }

  private construirClave(accion: string, identificador: string): string {
    return `ratelimit:${accion}:${identificador.trim().toLowerCase()}`;
  }
}
