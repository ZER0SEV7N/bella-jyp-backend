//src/common/errors/errores-negocio.ts
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Catálogo único de errores de negocio que hoy llegan como texto plano desde PostgreSQL
 * (triggers que lanzan `RAISE EXCEPTION ... ERRCODE 23514`) o desde reglas de dominio.
 *
 * Motivo (PLA-F7 / ASI-F6): sin esta traducción, un rechazo legítimo de la base de datos
 * se convertía en un `500 Internal Server Error`, ocultando la causa real al usuario.
 *
 * Regla de mantenimiento: cada marca debe ser un fragmento estable y sin tildes del mensaje
 * original. Si un trigger cambia su texto, se actualiza la marca en este archivo y su prueba.
 */
export interface ReglaErrorNegocio {
  /** Fragmento (expresión regular) que identifica el error dentro del mensaje original. */
  readonly marca: RegExp;
  /** Código HTTP con el que debe responder la API. */
  readonly status: number;
  /** Título corto que verá el cliente. */
  readonly title: string;
  /** Explicación accionable para el usuario. */
  readonly detail: string;
}

/**
 * Orden de evaluación: las reglas más específicas van primero para que un mensaje
 * que contenga varias marcas se traduzca con la intención más precisa.
 */
export const REGLAS_ERROR_NEGOCIO: readonly ReglaErrorNegocio[] = [
  {
    marca: /PLANILLA_BLOQUEADA/,
    status: HttpStatus.CONFLICT,
    title: 'Planilla no modificable',
    detail:
      'La planilla del período ya está cerrada; no se pueden modificar sus datos, novedades ni desembolsos.',
  },
  {
    marca: /ASISTENCIA_BLOQUEADA/,
    status: HttpStatus.CONFLICT,
    title: 'Asistencia no modificable',
    detail:
      'La asistencia del período está aprobada o su planilla está cerrada. Registre una decisión o reabra la incidencia.',
  },
  {
    marca: /novedad ya est\S* resuelta/i,
    status: HttpStatus.CONFLICT,
    title: 'Novedad ya resuelta',
    detail:
      'La novedad ya fue aprobada, rechazada o anulada; consulte su historial.',
  },
  {
    marca: /novedad original se conserva/i,
    status: HttpStatus.CONFLICT,
    title: 'Novedad inmutable',
    detail:
      'La novedad original se conserva. Anule y registre una nueva si debe corregirla.',
  },
  {
    marca: /novedad corresponde a un contador activo/i,
    status: HttpStatus.FORBIDDEN,
    title: 'Resolución no autorizada',
    detail: 'Solo un contador activo puede resolver novedades de planilla.',
  },
  {
    marca: /desembolso debe corresponder al monto y colaborador/i,
    status: HttpStatus.CONFLICT,
    title: 'Desembolso inconsistente',
    detail:
      'El desembolso debe coincidir con el monto y el colaborador de un adelanto aprobado.',
  },
  {
    marca: /vigencias del par\S*metro/i,
    status: HttpStatus.CONFLICT,
    title: 'Vigencia superpuesta',
    detail:
      'Las vigencias del parámetro legal se superponen. Ajuste el rango de fechas.',
  },
  {
    marca: /vigencias AFP se superponen/i,
    status: HttpStatus.CONFLICT,
    title: 'Vigencia AFP superpuesta',
    detail:
      'Las vigencias de la comisión AFP se superponen. Ajuste el rango de fechas.',
  },
  {
    marca: /metro negativo o fechas invertidas/i,
    status: HttpStatus.BAD_REQUEST,
    title: 'Parámetro legal inválido',
    detail:
      'El parámetro legal no admite valores negativos ni fechas invertidas.',
  },
  {
    marca: /Tasa, tope o vigencia AFP/i,
    status: HttpStatus.BAD_REQUEST,
    title: 'Comisión AFP inválida',
    detail: 'La tasa, el tope o la vigencia de la comisión AFP no son válidos.',
  },
  {
    marca: /solicitud de asistencia aprobada requiere ambas fechas/i,
    status: HttpStatus.BAD_REQUEST,
    title: 'Rango de fechas incompleto',
    detail:
      'Una solicitud de asistencia aprobada requiere fecha de inicio y de fin.',
  },
  {
    marca: /intervalo excede el alcance de un a\S*o/i,
    status: HttpStatus.BAD_REQUEST,
    title: 'Rango de fechas excesivo',
    detail: 'El intervalo solicitado no puede superar un año.',
  },
];

/**
 * Devuelve el mensaje de un error desconocido sin asumir su forma.
 * Se usa para inspeccionar el texto crudo que devuelve Prisma o PostgreSQL.
 * @param error - Error capturado por el filtro global.
 * @returns Texto del error o cadena vacía si no se puede obtener.
 */
export function mensajeDeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

/**
 * Traduce un mensaje técnico a una excepción HTTP de negocio.
 * @param mensaje - Texto original del error (por ejemplo, el de un trigger de PostgreSQL).
 * @returns La excepción HTTP equivalente o `null` si el mensaje no es un error de negocio conocido.
 */
export function traducirErrorNegocio(mensaje: string): HttpException | null {
  if (!mensaje) return null;

  const regla = REGLAS_ERROR_NEGOCIO.find(({ marca }) => marca.test(mensaje));
  if (!regla) return null;

  //Se responde con el cuerpo RFC 7807 completo para que el filtro global no tenga que reinterpretarlo.
  return new HttpException(
    {
      type: `https://api.jyp.com/errors/${regla.status}`,
      title: regla.title,
      status: regla.status,
      detail: regla.detail,
    },
    regla.status
  );
}
