//src/common/inteceptors/transform-response.interceptors.ts
//Interceptor para transformar la respuesta de las rutas, 
//se puede configurar para que solo transforme ciertas rutas o ciertos tipos de respuestas
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
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
export class TransformResponseInterceptor<T> implements NestInterceptor<T, ResponseFormat<T>> {
    intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ResponseFormat<T>> {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest<FastifyRequest>();
        const response = ctx.getResponse<FastifyReply>();
        const statusCode = response.statusCode;

        return next.handle().pipe(
            map((data) => ({
                statusCode: statusCode,
                data: (data || null) as T,
                meta: {
                    message: this.obtenerMensaje(statusCode),
                    path: request.url,
                    timestamp: new Date().toISOString(),
                },
            })),
        );
    }

    //Método privado para obtener el mensaje según el código de estado
    private obtenerMensaje(statusCode: number): string {
        switch (statusCode) {
            case 200: return 'Operación exitosa.';
            case 201: return 'Recurso creado o provisionado exitosamente.';
            case 202: return 'Petición aceptada para procesamiento en segundo plano.';
            case 204: return 'Operación exitosa sin contenido.';
            default: return 'Petición procesada.';
        }
    }
}