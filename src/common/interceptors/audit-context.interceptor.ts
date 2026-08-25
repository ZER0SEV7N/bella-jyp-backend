//src/common/interceptors/audit-context.interceptor.ts
//Interceptor para capturar el contexto de auditoría (usuario e IP) en cada solicitud HTTP
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';
import type { FastifyRequest } from 'fastify';
import { CLS_USER_ID, CLS_IP_ADDRESS } from '@/common/cls/cls.constants';

/**
 * Interceptor que captura el contexto de auditoría (usuario e IP) en cada solicitud HTTP.
 * Este interceptor se ejecuta antes de que el controlador maneje la solicitud y 
 * extrae la información relevante del usuario autenticado y la dirección IP.
 * La información capturada se almacena en un contexto aislado (Thread-safe) 
 * usando ClsService, lo que permite que la información de auditoría esté disponible para cualquier operación de base de datos posterior.
 * Esto es especialmente útil para la extensión de auditoría de Prisma, 
 * que puede registrar automáticamente quién realizó una operación y desde qué dirección IP.
 */
@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    //Extraer la solicitud HTTP del contexto de ejecución
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const userId =(request as FastifyRequest & { user?: { id?: string | number } }).user?.id || null;

    //Capturar la IP de forma segura
    const ipAddress = request.ip || (request.headers['x-forwarded-for'] as string) || '127.0.0.1';

    //Inyectar en la memoria aislada del hilo (Thread-safe) para Prisma
    this.cls.set(CLS_USER_ID, userId);
    this.cls.set(CLS_IP_ADDRESS, ipAddress);

    return next.handle();
  }
}
