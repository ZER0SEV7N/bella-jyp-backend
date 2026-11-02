//src/common/guards/firma-n8n.guard.ts
import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/common/cls/redis.constants';
import { firmarM2M, verificarFirmaM2M } from '@/common/utils/firma-m2m.util';

/**
 * Guardia de autenticación para verificar la firma de las solicitudes entrantes desde n8n.
 * Esta guardia asegura que las solicitudes provengan de n8n y que la firma sea válida.
 * Utiliza Redis para almacenar y verificar firmas válidas.
 */
@Injectable()
export class FirmaN8NGuard implements CanActivate {
    constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

    /**
     * Función que determina si la solicitud entrante puede ser procesada.
     * Verifica la firma de la solicitud y asegura que provenga de n8n.
     * @param context - Contexto de ejecución que contiene la solicitud entrante.
     * @returns boolean - Retorna true si la solicitud es válida, de lo contrario lanza una excepción.
     * @throws UnauthorizedException - Si la firma es inválida o no se encuentra en Redis.
     * @throws ServiceUnavailableException - Si hay un error al acceder a Redis.
     */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        //Obtiene la solicitud HTTP desde el contexto de ejecución
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        
        //Verifica que la integración HMAC esté configurada correctamente
        const secret = process.env.N8N_WEBHOOK_SECRET;
        if(!secret || secret.length < 32 ) 
            throw new ServiceUnavailableException('La integración HMAC todavía no está configurada.');

        const instante = request.headers['x-jyp-timestamp']; //Obtiene el timestamp de la cabecera de la solicitud
        const nonce = request.headers['x-jyp-nonce']; //Obtiene el nonce de la cabecera de la solicitud
        const firma = request.headers['x-jyp-signature']; //Obtiene la firma de la cabecera de la solicitud

        //Valida que el timestamp sea un string de 10 dígitos y que esté dentro de una ventana temporal de 5 minutos
        if(typeof instante !== 'string' || !/^\d{10}$/.test(instante) || Math.abs(Date.now() / 1000 - Number(instante)) > 300)
            throw new UnauthorizedException('La firma está ausente o fuera de su ventana temporal.');

        //Valida que el nonce sea un string en formato UUID y que la firma sea un string
        if(typeof nonce !== 'string' ||
            !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test( nonce ) || typeof firma !== 'string' )
            throw new UnauthorizedException('Cabeceras HMAC inválidas.');

        //Verifica si la firma ya ha sido utilizada consultando Redis
        const esperada = firmarM2M(
            secret,
            request.method,
            request.url,
            instante,
            nonce,
            request.body ?? null
        );

        //Valida que la firma generada coincida con la firma proporcionada en la solicitud
        if(!verificarFirmaM2M(esperada, firma))
            throw new UnauthorizedException('La firma del mensaje no es válida.');

        //Un nonce solo puede usarse una vez, incluso entre replicas del backend.
        const reservado = await this.redisClient.set(
            `n8n:nonce:${nonce}`,
            '1',
            'EX',
            600,
            'NX'
        );

        //Si el valor devuelto por Redis no es 'OK', significa que el nonce ya ha sido utilizado, por lo que se lanza una excepción de autorización.
        if(reservado !== 'OK')
            throw new UnauthorizedException('El mensaje ya fue utilizado.');
        return true;
    }
}

