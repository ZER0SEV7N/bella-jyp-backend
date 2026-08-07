//src/common/inteceptors/transform-response.interceptors.ts
//Interceptor para transformar la respuesta de las rutas,
//se puede configurar para que solo transforme ciertas rutas o ciertos tipos de respuestas
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FastifyReply, FastifyRequest } from 'fastify';

//Interceptor
export interface ResponseFormat<T> {
  statusCode: number;
  data: T;
  meta: {
    message: string;
    path: string;
    timestamp: string;
  };
}

//Interceptor para transformar la respuesta de las rutas
@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  ResponseFormat<T>
> {
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
        if (data && data.data && data.meta) {
          return {
            statusCode,
            data: data.data,
            meta: {
              ...data.meta,
              message: 'Operación exitosa.',
              path: request.url,
              timestamp: new Date().toISOString(),
            },
          };
        }

        return {
          statusCode,
          data: (data || null) as T,
          meta: {
            message: this.obtenerMensaje(statusCode),
            path: request.url,
            timestamp: new Date().toISOString(),
          },
        };
      }),
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
  }
}
