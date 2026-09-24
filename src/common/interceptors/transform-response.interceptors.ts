//src/common/inteceptors/transform-response.interceptors.ts
import {Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Interfaz que define la estructura de la respuesta transformada.
 * @template T - Tipo de datos que se espera en la respuesta.
 * @meta - Se compone de un mensaje, la ruta de la solicitud y un timestamp.
 */
export interface ResponseFormat<T> {
  statusCode: number;
  data: T;
  meta: {
    message: string;
    path: string;
    timestamp: string;
  };
}

/**
 * Interceptor que transforma la respuesta de las solicitudes HTTP.
 * Este interceptor se encarga de envolver la respuesta en un formato estandarizado que incluye:
 * - El código de estado HTTP.
 * - Los datos de la respuesta.
 * - Metadatos adicionales como un mensaje, la ruta de la solicitud y un timestamp.
 * implementa NestInterceptor para integrarse con el ciclo de vida de las solicitudes en NestJS.
 * @template T - Tipo de datos que se espera en la respuesta.
 * @responseFormat - Estructura de la respuesta transformada.
 */
@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<T, ResponseFormat<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ResponseFormat<T>> {
    const ctx = context.switchToHttp(); //Contexto de la petición HTTP
    const request = ctx.getRequest<FastifyRequest>(); //Petición HTTP
    const response = ctx.getResponse<FastifyReply>(); //Respuesta HTTP
    const statusCode = response.statusCode; //Código de estado HTTP de la respuesta

    //Transformar la respuesta
    return next.handle().pipe(
      map((data: any) => {
        //En caso de que la data tenga la estructura {data: [], meta: {}} se respeta esa estructura
        if (data?.data && data?.meta) 
          return {
            statusCode,
            data: data.data,
            meta: {
              ...data.meta,
              message: 'Operación exitosa.',
              path: request.url,
              timestamp: new Date().toISOString()
            }
          };
        

        return {
          statusCode,
          data: (data || null) as T,
          meta: {
            message: this.obtenerMensaje(statusCode),
            path: request.url,
            timestamp: new Date().toISOString()
          }
        };
      })
    );
  }

  //Método privado para obtener el mensaje según el código de estado
  private obtenerMensaje(statusCode: number): string {
    switch (statusCode) {
      case 200:
        return 'Operación exitosa.';
      case 201:
        return 'Recurso creado o provisionado exitosamente.';
      case 202:
        return 'Petición aceptada para procesamiento en segundo plano.';
      case 204:
        return 'Operación exitosa sin contenido.';
      default:
        return 'Petición procesada.';
    }
  };
}
