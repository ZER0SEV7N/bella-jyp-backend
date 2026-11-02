//src/modules/integraciones/use-cases/atenderTrabajoN8N.useCase.ts
import {ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CryptoUtil } from '@/common/utils/crypto.util';
import type { ResultadoIntegracionDto } from '@jyp/shared-contracts';
import { Prisma } from '@prisma/client';

/**
 * Caso de uso para atender un trabajo de integración con el servicio externo de N8N.
 * Este caso de uso maneja la lógica de negocio relacionada con la atención de trabajos de integración,
 * incluyendo la validación de la existencia del trabajo, la reclamación del trabajo para su procesamiento
 * y la finalización del trabajo con el resultado obtenido. También se encarga de garantizar la integridad
 */
@Injectable()
export class AtenderTrabajoN8nUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Valida la existencia de un trabajo de integración por su ID.
     * @param id - El ID del trabajo de integración a validar.
     * @returns - Un objeto que contiene el ID del trabajo de integración si existe.
     */
    async validar(id: string) {
        // Se consulta el trabajo de integración en la base de datos por su ID.
        const trabajo = await this.prisma.integracionTrabajo.findUnique({ where: { id } });
        
        // Si el trabajo no existe, se lanza una excepción NotFoundException.
        if (!trabajo) throw new NotFoundException('Trabajo inexistente.');
        
        // Se retorna un objeto que contiene el ID del trabajo de integración.
        return { trabajo_id: trabajo.id };
    }

    /**
     * Funcion asincrónica para reclamar un trabajo de integración para su procesamiento.
     * Este método actualiza el estado del trabajo a 'PROCESANDO' y asigna un ID de ejecución.
     * @param id - El ID del trabajo de integración a reclamar.
     * @param ejecucionId - El ID de ejecución que se asignará al trabajo reclamado.
     * @returns - Un objeto que contiene el ID del trabajo, su tipo, periodo, total de planillas y la solicitud descifrada.
     */
    async reclamar(id: string, ejecucionId: string) {
        // Se intenta actualizar el estado del trabajo a 'PROCESANDO' solo si actualmente está en estado 'PENDIENTE'.
        const tomado = await this.prisma.integracionTrabajo.updateMany({
            where: { id, estado: 'PENDIENTE' },
            data: {
                estado: 'PROCESANDO',
                ejecucion_id: ejecucionId,
                iniciado_en: new Date(),
            },
        });

        // Si no se actualizó ningún registro, significa que el trabajo ya fue reclamado o finalizado, por lo que se lanza una excepción ConflictException.
        if (tomado.count !== 1)
            throw new ConflictException('El trabajo ya fue reclamado o finalizado.');

        // Se consulta nuevamente el trabajo de integración para obtener sus detalles.
        const trabajo = await this.prisma.integracionTrabajo.findUniqueOrThrow({ where: { id } });
        
        // Se descifra y parsea la solicitud del trabajo.
        const solicitud = JSON.parse(CryptoUtil.decrypt(trabajo.solicitud_cifrada));
        
        // Se valida si el trabajo es de tipo 'RESET_PASSWORD' y si la solicitud ha expirado. 
        // Si ha expirado, se actualiza el estado del trabajo a 'FALLIDO' y se lanza una excepción ConflictException.
        if (trabajo.tipo === 'RESET_PASSWORD' && Date.parse(solicitud.expira_en) <= Date.now()) {
            await this.prisma.integracionTrabajo.update({
                where: { id },
                data: {
                    estado: 'FALLIDO',
                    error: 'El enlace de recuperación expiró antes de enviarse.',
                    finalizado_en: new Date(),
                },
            });
            throw new ConflictException('El enlace de recuperación expiró.');
        }

        // Se retorna un objeto que contiene el ID del trabajo, su tipo, periodo, total de planillas y la solicitud descifrada.
        return {
            id,
            tipo: trabajo.tipo,
            periodo: trabajo.periodo,
            total: trabajo.planilla_ids.length,
            solicitud,
        };
    }

    /**
     * Finaliza un trabajo de integración con el resultado obtenido.
     * @param id - El ID del trabajo de integración a finalizar.
     * @param ejecucionId - El ID de ejecución que se asignó al trabajo reclamado.
     * @param resultado - El resultado de la integración obtenido del servicio externo.
     * @returns - Un objeto que indica que el trabajo ha sido finalizado correctamente.
     */
    async finalizar( id: string, ejecucionId: string, resultado: ResultadoIntegracionDto ) {
        // Separar la emisión del archivo y el envío permite conservar resultados parciales.
        let estado: 'COMPLETADO' | 'PARCIAL' | 'FALLIDO' = 'COMPLETADO';

        // Se determina el estado final del trabajo basado en el resultado de la integración.
        if (resultado.error) {
            estado = resultado.archivos.length > 0 ? 'PARCIAL' : 'FALLIDO';

        // Si algún correo falló o quedó indeterminado, se considera que el trabajo está parcialmente completado.
        } else if (resultado.correos.some((correo) => ['FALLIDO', 'INDETERMINADO'].includes(correo.estado))) {
            estado = 'PARCIAL';
        }

        // Se actualiza el trabajo de integración en la base de datos con el estado final, resultado y fecha de finalización.
        const actualizado = await this.prisma.integracionTrabajo.updateMany({
            where: { id, estado: 'PROCESANDO', ejecucion_id: ejecucionId },
            data: {
                // Un PDF archivado sigue siendo útil aunque el envío SMTP quede ambiguo.
                estado,
                resultado: resultado as unknown as Prisma.InputJsonValue,
                error: resultado.error ?? null,
                finalizado_en: new Date(),
            },
        });

        // Si no se actualizó ningún registro, significa que la ejecución ya no puede finalizar este trabajo, por lo que se lanza una excepción ConflictException.
        if (actualizado.count !== 1)
            throw new ConflictException('La ejecución ya no puede finalizar este trabajo.');
        
        // Se retorna un objeto que indica que el trabajo ha sido finalizado correctamente.
        return { id, finalizado: true };
    }
}
