//src/common/filters/rfc7807-exception.filter.ts
//Filtro para manejar las excepciones y formatearlas según el estándar RFC 7807
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
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
    let errores: unknown;

    //Si la excepción es una instancia de HttpException, se obtiene el status y el mensaje de la excepción
    if (exception instanceof HttpException) {
      ({ status, title, detail, type, errores } = this.describirHttp(exception));
      
      //Atrapar errores del Prisma
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2003', 'P2025'].includes(exception.code)) {
      //Mapear los códigos de error de Prisma a códigos de estado HTTP y mensajes de error específicos
      status = exception.code === 'P2025' ? HttpStatus.NOT_FOUND : HttpStatus.CONFLICT;
      title = status === HttpStatus.NOT_FOUND ? 'Recurso no encontrado' : 'Conflicto de datos';
      
      //Determinar el mensaje de detalle según el código de error
      if (exception.code === 'P2002') {
        detail = 'Ya existe un registro con estos datos únicos.';
      
      //Si el código de error es P2025, significa que el recurso no existe o cambió durante la operación.
      } else if (exception.code === 'P2003') {
        detail = 'La operación referencia datos inexistentes o todavía relacionados.';
      
      //Si el código de error es P2003, significa que la operación referencia datos inexistentes o todavía relacionados.
      } else {
        detail = 'El recurso ya no existe o cambió durante la operación.';
      }

      //Establecer el tipo de error según el código de estado HTTP
      type = `https://api.jyp.com/errors/${status}`;
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
      ...(errores !== undefined ? { errores } : {}),
      timestamp: new Date().toISOString(),
    });
  }
  
  /**
   * Método privado que describe una excepción HTTP y devuelve un objeto con información estandarizada según el RFC 7807.
   * Este método extrae la información relevante de la excepción y la formatea en un objeto que cumple con el estándar RFC 7807.
   * Esto permite que los clientes de la API comprendan y manejen los errores de manera consistente.
   * @param exception - La excepción HTTP que se desea describir.
   * @returns - Un objeto que contiene el código de estado, título, detalle, tipo y errores adicionales de la excepción.
   */
  private describirHttp(exception: HttpException) {
    //Obtener el código de estado y la respuesta de la excepción
    const status = exception.getStatus();
    const respuesta = exception.getResponse();
    
    //Si la respuesta es una cadena de texto, se devuelve un objeto con la información básica.
    if (typeof respuesta === 'string')
      return { status, title: exception.name, detail: respuesta, type: `https://api.jyp.com/errors/${status}`, errores: undefined };
    
    //Si la respuesta es un objeto, se extraen los datos relevantes y se devuelven en un formato estandarizado.
    const datos = respuesta as {
      title?: string;
      detail?: string;
      message?: string | string[];
      type?: string;
      error?: string;
      errores?: unknown;
    };

    //Si el mensaje de detalle es un arreglo, se une en una cadena de texto separada por punto y coma; de lo contrario, se utiliza el mensaje tal cual.
    const mensaje = datos.detail ?? datos.message ?? exception.message;

    //Devolver un objeto con la información estandarizada según el RFC 7807, incluyendo el código de estado, título, detalle, tipo y errores adicionales.
    return {
      status,
      title: datos.title ?? datos.error ?? exception.name,
      detail: Array.isArray(mensaje) ? mensaje.join('; ') : mensaje,
      type: datos.type ?? `https://api.jyp.com/errors/${status}`,
      errores: datos.errores,
    };
  }
}
