//src/common/filters/rfc7807-exception.filter.ts
//Filtro para manejar las excepciones y formatearlas según el estándar RFC 7807
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Filtro que maneja las excepciones y las formatea según el estándar RFC 7807.
 * Este filtro captura todas las excepciones lanzadas en la aplicación y las transforma en un formato estandarizado.
 * El formato incluye información como el tipo de error, el título, el código de estado HTTP, el detalle del error,
 * la instancia de la solicitud y la marca de tiempo.
 * Esto facilita la comprensión y el manejo de errores por parte de los clientes que consumen la API.
 */
@Catch()
export class Rfc7807ExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(Rfc7807ExceptionFilter.name);

  /**
   * Maneja la excepción capturada y envía una respuesta formateada según RFC 7807.
   * @param exception - La excepción capturada que puede ser de cualquier tipo.
   * @param host - El contexto de ejecución que contiene la solicitud y la respuesta.
   */
  catch(exception: unknown, host: ArgumentsHost) {
    //Obtener el contexto de la solicitud y la respuesta de Fastify
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<FastifyReply>();
    const req = ctx.getRequest<FastifyRequest>();

    //Inicializar variables para el código de estado, título, detalle, tipo y errores adicionales del error.
    let status = HttpStatus.INTERNAL_SERVER_ERROR; //status por defecto
    let title = 'Error Interno del Servidor';
    let detail = 'Ocurrió un error inesperado en el servidor.';
    let type = 'https://api.jyp.com/errors/internal-server-error';
    let errores: Record<string, string[]> | undefined;

    //Si la excepción es una instancia de HttpException, se obtiene el status y el mensaje de la excepción
    if (exception instanceof HttpException) {
      ({ status, title, detail, type, errores } = this.describirHttp(exception));

      //Si el código de estado es 500 o superior, se registra un error en el log con la información de la solicitud y la traza de la excepción.
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(`[${req.method} ${req.url}] HttpException ${status}: ${detail}`, exception.stack );
      }
    //Si la excepción es un error conocido de Prisma (P2002, P2003, P2025), se traduce a una respuesta RFC 7807 con campos asociados.
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2003', 'P2025'].includes(exception.code)) {
      ({ status, title, detail, type, errores } = this.describirErrorPrisma(exception));
      
    //Si la excepción no es una HttpException ni un error conocido de Prisma, se registra un error en el log con la información de la solicitud y la traza de la excepción.
    } else {
      this.logger.error(`[${req.method} ${req.url}] Error no manejado:`, exception instanceof Error ? exception.stack : JSON.stringify(exception));
    }

    res.status(status).send({
      type,
      title,
      status,
      detail,
      instance: req.url,
      ...(errores !== undefined ? { errores } : {}),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Describe una excepción de tipo HttpException y extrae la información relevante para formatearla según RFC 7807.
   * Si la excepción contiene un campo `campo` explícito y no tiene `errores`, se construye automáticamente un mapa de errores.
   * @param exception - La excepción de tipo HttpException que se desea describir.
   * @returns - Un objeto con la estructura RFC 7807 que describe la excepción, incluyendo el código de estado HTTP, título, detalle, tipo y errores adicionales si los hay.
   */
  private describirHttp(exception: HttpException) {
    const status = exception.getStatus();
    const respuesta = exception.getResponse();

    // Si la respuesta es un string, se construye un objeto RFC 7807 con el mensaje de detalle y el título de la excepción.
    if (typeof respuesta === 'string') {
      return {
        status,
        title: exception.name,
        detail: this.sanitizarDetalle(status, respuesta),
        type: `https://api.jyp.com/errors/${status}`,
        errores: undefined,
      };
    }

    // Si la respuesta es un objeto, se extraen los campos relevantes para construir un objeto RFC 7807 con el título, detalle, tipo y errores adicionales si los hay.
    const datos = respuesta as {
      title?: string;
      detail?: string;
      message?: string | string[];
      type?: string;
      error?: string;
      errores?: Record<string, string[]>;
      campo?: string;
    };

    // Se obtiene el mensaje de detalle de la respuesta, ya sea del campo `detail`, `message` o del mensaje de la excepción.
    const mensajeBruto = datos.detail ?? datos.message ?? exception.message;
    const texto = Array.isArray(mensajeBruto) ? mensajeBruto.join('; ') : mensajeBruto;
    const detail = this.sanitizarDetalle(status, texto);

    // Si la excepción de negocio indica un `campo` explícito y no trae `errores`, se arma el mapa automáticamente (COM-M1)
    const errores = datos.errores ?? (datos.campo && status < 500 ? { [datos.campo]: [detail] } : undefined);

    return {
      status,
      title: datos.title ?? datos.error ?? exception.name,
      detail,
      type: datos.type ?? `https://api.jyp.com/errors/${status}`,
      errores,
    };
  }

  /**
   * Extrae la estructura RFC 7807 de un error conocido de Prisma (P2002, P2003, P2025).
   * Si es un error 500 y el mensaje contiene trazas técnicas de Prisma o SQL, lo sanitiza para no filtrar esquema (COM-F2).
   * @param exception - La excepción de Prisma que se desea describir.
   * @returns - Un objeto con la estructura RFC 7807 que describe el error de Prisma, incluyendo el código de estado HTTP, título, detalle, tipo y errores adicionales si los hay.
   */
  private describirErrorPrisma(exception: Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2025') {
      return {
        status: HttpStatus.NOT_FOUND,
        title: 'Recurso no encontrado',
        detail: 'El recurso ya no existe o cambió durante la operación.',
        type: `https://api.jyp.com/errors/${HttpStatus.NOT_FOUND}`,
        errores: undefined,
      };
    }

    //P2002: Unique constraint failed
    if (exception.code === 'P2002') {
      //Extrae los campos únicos involucrados en la violación de la restricción única desde el objeto `meta` de la excepción.
      const target = exception.meta?.target;
      let campos: string[];

      //Si `target` es un array, se mapean los campos a strings; si es un string, se coloca en un array; si no hay campos, se deja vacío.
      if (Array.isArray(target)) {
        campos = target.map(String);
      } else if (typeof target === 'string') {
        campos = [target];
      } else {
        campos = [];
      }

      //Si hay campos únicos involucrados, se construye un objeto de errores con los campos y mensajes correspondientes.
      const errores = campos.length > 0
          ? Object.fromEntries(campos.map((c) => [c, ['Ya existe un registro con este valor.']]))
          : undefined;

      //Si no hay campos únicos involucrados, se devuelve un error genérico de conflicto de datos.
      return {
        status: HttpStatus.CONFLICT,
        title: 'Conflicto de datos',
        detail: 'Ya existe un registro con estos datos únicos.',
        type: `https://api.jyp.com/errors/${HttpStatus.CONFLICT}`,
        errores,
      };
    }

    //P2003: Foreign key constraint failed
    return {
      status: HttpStatus.CONFLICT,
      title: 'Conflicto de datos',
      detail: 'La operación referencia datos inexistentes o todavía relacionados.',
      type: `https://api.jyp.com/errors/${HttpStatus.CONFLICT}`,
      errores: undefined,
    };
  }

  /**
   * Sanitiza el detalle del error para evitar filtrar información sensible o técnica en errores internos del servidor (500+).
   * Si el detalle contiene trazas técnicas de Prisma o SQL, se reemplaza por un mensaje genérico.
   * Esto ayuda a proteger la información del esquema de la base de datos y evita exponer detalles internos a los clientes.
   * @param status - Código de estado HTTP del error.
   * @param detalle - Mensaje de detalle del error que puede contener información sensible o técnica.
   * @returns - Mensaje de detalle sanitizado, o el mensaje original si no es un error interno del servidor.
   */
  private sanitizarDetalle(status: number, detalle: string): string {
    //Si el código de estado es menor a 500, se devuelve el detalle original.
    if (status < HttpStatus.INTERNAL_SERVER_ERROR) {
      return detalle;
    }

    //Si el detalle contiene trazas técnicas de Prisma o SQL, se reemplaza por un mensaje genérico para evitar filtrar información sensible.
    if (/Invalid `.*prisma|Unique constraint failed|Foreign key constraint|SELECT |INSERT INTO |UPDATE /i.test(detalle)) {
      return 'Ocurrió un error interno al procesar la operación.';
    }
    return detalle;
  }
}
