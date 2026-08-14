//src/common/filters/rfc7807-exception.filter.ts
//Filtro para manejar las excepciones y formatearlas según el estándar RFC 7807
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
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
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<FastifyReply>();
    const req = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR; //status por defecto
    let title = 'Error Interno del Servidor';
    let detail = 'Ocurrió un error inesperado en el servidor.';
    let type = 'https://api.jyp.com/errors/internal-server-error';

    //Si la excepción es una instancia de HttpException, se obtiene el status y el mensaje de la excepción
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;

      //Si el error ya esta formatedo por el Auth, se mantiene el formato original
      if (exceptionResponse?.type && exceptionResponse?.title) {
        title = exceptionResponse.title;
        detail = exceptionResponse.detail;
        type = exceptionResponse.type;
      } else {
        //Si el error no esta formateado, se formatea según el estándar RFC 7807
        title = exceptionResponse?.error || exception.name;
        detail = exceptionResponse?.message || exception.message;
        type = `https://api.jyp.com/errors/${status}`;
      }
      //Atrapar errores del Prisma
    } else {
      console.error('Error no manejado:', exception);
    }

    //Estructura estandar del RFC 7807
    res.status(status).send({
      type,
      title,
      status,
      detail,
      instance: req.url,
      timestamp: new Date().toISOString()
    });
  }
}
