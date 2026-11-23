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
  private static readonly MAX_INTENTOS_DEFECTO = 5; // Número máximo de intentos fallidos permitidos antes de bloquear temporalmente la acción.
  private static readonly VENTANA_SEGUNDOS_DEFECTO = 15 * 60; // 15 minutos

  constructor(@Inject(REDIS_CLIENT) private readonly redis?: Redis) {}

  /**
   * Verifica si la acción sensible está disponible para el identificador dado, comparando el número de intentos fallidos con el máximo permitido.
   * @param accion - Nombre de la acción sensible (por ejemplo, 'login', 'recuperar-password').
   * @param identificador - Identificador único del usuario o recurso (por ejemplo, correo electrónico, ID de usuario).
   * @param maxIntentos - Número máximo de intentos fallidos permitidos antes de bloquear temporalmente la acción. Si no se proporciona, se utiliza el valor por defecto.
   * @returns - Una promesa que se resuelve si la acción está disponible; de lo contrario, lanza una excepción HTTP 429 (Too Many Requests) con un mensaje de error.
   */
  async verificarDisponible(accion: string, identificador: string, maxIntentos = ControlIntentosService.MAX_INTENTOS_DEFECTO ): Promise<void> {
    //Si no hay un cliente Redis disponible o no tiene la función `get`, simplemente retorna sin realizar ninguna verificación.
    if (!this.redis || typeof this.redis.get !== 'function') return;

    // Construye la clave de Redis para el contador de intentos fallidos utilizando la acción y el identificador proporcionados.
    const clave = this.construirClave(accion, identificador);
    const actual = Number((await this.redis.get(clave)) ?? '0');

    //Si el número actual de intentos fallidos es mayor o igual al máximo permitido, lanza una excepción HTTP 429 (Too Many Requests) con un mensaje de error detallado.
    if (actual >= maxIntentos) throw new HttpException({
      type: 'https://api.jyp.com/errors/too-many-requests',
      title: 'Demasiados Intentos',
      status: HttpStatus.TOO_MANY_REQUESTS,
      detail: 'Se ha superado el límite de intentos permitidos. Espere 15 minutos antes de volver a intentarlo.',
    }, HttpStatus.TOO_MANY_REQUESTS );
    
  }

  /**
   * Registra un intento fallido o una solicitud sensible en la ventana de tiempo indicada.
   * Si es el primer intento, establece un tiempo de expiración para la ventana de tiempo.
   * @param accion - Nombre de la acción sensible (por ejemplo, 'login', 'recuperar-password').
   * @param identificador - Identificador único del usuario o recurso (por ejemplo, correo electrónico, ID de usuario).
   * @param ventanaSegundos - Duración de la ventana de tiempo en segundos para contar los intentos fallidos. Si no se proporciona, se utiliza el valor por defecto.
   * @returns - Una promesa que se resuelve con el número actual de intentos fallidos después de registrar el intento.
   */
  async registrarIntento(accion: string, identificador: string, ventanaSegundos = ControlIntentosService.VENTANA_SEGUNDOS_DEFECTO): Promise<number> {
    // Si no hay un cliente Redis disponible o no tiene la función `incr`, simplemente retorna 0 sin registrar ningún intento.
    if (!this.redis || typeof this.redis.incr !== 'function') return 0;

    // Construye la clave de Redis para el contador de intentos fallidos utilizando la acción y el identificador proporcionados.
    const clave = this.construirClave(accion, identificador);
    const conteo = await this.redis.incr(clave);
    if (conteo === 1 && typeof this.redis.expire === 'function') {
      await this.redis.expire(clave, ventanaSegundos);
    }
    return conteo;
  }

  /**
   * Limpia el contador de intentos fallidos para la acción y el identificador proporcionados, eliminando la clave correspondiente en Redis.
   * Esto se utiliza típicamente después de un intento exitoso para restablecer el estado de la acción sensible.
   * @param accion - Nombre de la acción sensible (por ejemplo, 'login', 'recuperar-password').
   * @param identificador - Identificador único del usuario o recurso (por ejemplo, correo electrónico, ID de usuario).
   * @returns - Una promesa que se resuelve cuando el contador ha sido limpiado.
   */
  async limpiarIntentos(accion: string, identificador: string): Promise<void> {
    if (!this.redis || typeof this.redis.del !== 'function') return;
    await this.redis.del(this.construirClave(accion, identificador));
  }

  /**
   * Construye una clave única para Redis basada en la acción y el identificador proporcionados.
   * @param accion - Nombre de la acción sensible (por ejemplo, 'login', 'recuperar-password').
   * @param identificador - Identificador único del usuario o recurso (por ejemplo, correo electrónico, ID de usuario).
   * @returns - Una cadena que representa la clave única para Redis, en el formato `ratelimit:{accion}:{identificador}`.
   */
  private construirClave(accion: string, identificador: string): string {
    return `ratelimit:${accion}:${identificador.trim().toLowerCase()}`;
  }
}
