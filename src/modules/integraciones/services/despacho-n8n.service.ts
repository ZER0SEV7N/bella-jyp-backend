//src/modules/integraciones/services/despacho-n8n.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { firmarM2M } from '@/common/utils/firma-m2m.util';

/**
 * Servicio para despachar trabajos de integración pendientes al servicio externo de N8N.
 * Este servicio se encarga de consultar periódicamente los trabajos de integración pendientes en la base de datos,
 * y despacharlos al servicio externo de N8N mediante solicitudes HTTP. También maneja la lógica de reintentos
 * y asegura que los trabajos sean despachados de manera segura y confiable.
 */
@Injectable()
export class DespachoN8nService {
    private readonly logger = new Logger(DespachoN8nService.name);
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Cron Job que se ejecuta cada 15 segundos para despachar trabajos de integración pendientes al servicio externo de N8N.
     * Este método consulta los trabajos pendientes en la base de datos, los marca como despachados y envía una solicitud HTTP
     * al servicio externo de N8N para procesarlos. Si ocurre un error durante el despacho, se registra un mensaje de advertencia
     * en los logs y el trabajo permanece en la bandeja de salida para reintentos futuros.
     * @returns - Una promesa que se resuelve cuando se completa el despacho de trabajos pendientes.
     * @throws - No lanza excepciones, pero registra advertencias en los logs si no se puede despachar un trabajo.
     */
    @Cron('*/15 * * * * *', { waitForCompletion: true })
    async pendientes(): Promise<void> {
        // Se obtienen las variables de entorno necesarias para despachar los trabajos al servicio externo de N8N.
        const url = process.env.N8N_WEBHOOK_URL_TRABAJOS;
        // Se valida que la URL y el secreto estén definidos y que el secreto tenga al menos 32 caracteres.
        const secreto = process.env.N8N_WEBHOOK_SECRET;

        // Si la URL o el secreto no están definidos o el secreto es demasiado corto, se omite el despacho de trabajos.
        if (!url || !secreto || secreto.length < 32) 
            return;
        
        // Se obtienen los trabajos pendientes que deben ser despachados.
        const trabajos = await this.prisma.integracionTrabajo.findMany({
            where: {
                estado: 'PENDIENTE',
                OR: [
                    { despachado_en: null },
                    { despachado_en: { lt: new Date(Date.now() - 60000) } },
                ],
            },
            orderBy: { creado_en: 'asc' },
            take: 20,
        });

        // Se itera sobre los trabajos pendientes y se intenta despacharlos al servicio externo de N8N.
        for (const trabajo of trabajos) {
            // La actualización condicional impide que dos réplicas despachen el mismo registro a la vez.
            const tomado = await this.prisma.integracionTrabajo.updateMany({
                where: {
                    id: trabajo.id,
                    estado: 'PENDIENTE',
                    intentos: trabajo.intentos,
                },
                data: { intentos: { increment: 1 }, despachado_en: new Date() },
            });

            // Si no se actualizó ningún registro, significa que otra réplica ya despachó el trabajo, por lo que se omite este trabajo.
            if (tomado.count !== 1) continue;

            // Se intenta despachar el trabajo al servicio externo de N8N mediante una solicitud HTTP POST.
            try {
                const cuerpo = { trabajo_id: trabajo.id };
                const instante = String(Math.floor(Date.now() / 1000));
                const nonce = IdentityGenerator.generateId();
                const rutaValidacion = '/api/v1/integraciones/n8n/validar';
                
                // Se envía la solicitud HTTP POST al servicio externo de N8N con los encabezados de autenticación y firma.
                await axios.post(url, cuerpo, {
                    timeout: 7000,
                    headers: {
                        'X-Jyp-Timestamp': instante,
                        'X-Jyp-Nonce': nonce,
                        'X-Jyp-Signature': firmarM2M(
                            secreto,
                            'POST',
                            rutaValidacion,
                            instante,
                            nonce,
                            cuerpo
                        ),
                    },
                });

            // Si la solicitud es exitosa, se registra el despacho del trabajo.
            } catch {
                // No se registra el cuerpo, la firma ni los tokens de recuperación en los logs.
                this.logger.warn(`No se pudo despachar el trabajo ${trabajo.id}; permanece en la bandeja de salida.`);
            }
        }
    }
}
