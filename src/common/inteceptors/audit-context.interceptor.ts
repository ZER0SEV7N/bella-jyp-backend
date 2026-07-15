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

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    //Extraer la solicitud HTTP del contexto de ejecución
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const userId =
      (request as FastifyRequest & { user?: { id?: string | number } }).user
        ?.id || null;

    // 3. Capturamos la IP de forma segura (requiere trustProxy habilitado en main.ts)[cite: 2]
    const ipAddress =
      request.ip ||
      (request.headers['x-forwarded-for'] as string) ||
      '127.0.0.1';

    // 4. Inyectamos en la memoria aislada del hilo (Thread-safe) para Prisma[cite: 2]
    this.cls.set(CLS_USER_ID, userId);
    this.cls.set(CLS_IP_ADDRESS, ipAddress);

    return next.handle();
  }
}
