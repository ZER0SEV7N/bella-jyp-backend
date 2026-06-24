//src/common/inteceptors/transform-response.interceptors.ts
//Interceptor para transformar la respuesta de las rutas, 
//se puede configurar para que solo transforme ciertas rutas o ciertos tipos de respuestas
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FastifyRequest } from 'fastify';

//Interceptor
export interface ResponseFormat<T> {
    data: T;
    meta: {
        path: string;
        timestamp: string;
    };
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<T, ResponseFormat<T>> {
    intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ResponseFormat<T>> {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest<FastifyRequest>();

        return next.handle().pipe(
            map((data) => ({
                data: (data || null) as T,
                meta: {
                    path: request.url,
                    timestamp: new Date().toISOString(),
                },
            })),
        );
    }
}