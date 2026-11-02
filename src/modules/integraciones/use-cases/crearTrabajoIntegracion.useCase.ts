//src/modules/integraciones/use-cases/crearTrabajoIntegracion.useCase.ts
import { BadRequestException, ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { IntegracionTrabajo } from '@prisma/client';
import type { SolicitarExportacionDto } from '@jyp/shared-contracts';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { ServerTime } from '@/common/utils/server-time';
import { jsonCanonicalize } from '@/common/utils/firma-m2m.util';

type TipoTrabajoIntegracion = SolicitarExportacionDto['tipo'] | 'RESET_PASSWORD';

/**
 * Caso de uso para crear un trabajo de integración con el servicio externo de N8N.
 * Este caso de uso maneja la lógica de negocio relacionada con la creación de trabajos de integración,
 * incluyendo la validación de los parámetros de entrada, la verificación de la existencia de planillas
 * y la creación del registro en la base de datos. También se encarga de garantizar la idempotencia
 * de las solicitudes mediante el uso de una clave única.
 */
@Injectable()
export class CrearTrabajoIntegracionUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta la creación de un trabajo de integración con el servicio externo de N8N.
     * @param dto - DTO que contiene los parámetros de la solicitud de exportación.
     * @param actor - Información del actor que realiza la operación, incluyendo su ID y rol.
     * @returns - Un resumen del trabajo de integración creado, incluyendo su ID, tipo, estado y periodo.
     */
    async execute(dto: SolicitarExportacionDto, actor: ActorOperacion) {
        ServerTime.validarPeriodo(dto.periodo);
        
        // Validaciones específicas según el tipo de integración
        // TODO: BBVA_HABERES e INTERBANK_HABERES requieren homologación de diseño de registros, no se permite sustituir por el formato BCP.
        if (['BBVA_HABERES', 'INTERBANK_HABERES'].includes(dto.tipo))
            throw new UnprocessableEntityException('El diseño de registros de este canal bancario requiere homologación. No se sustituye por el formato BCP.');

        // Validaciones específicas para BCP_HABERES
        if (dto.tipo === 'BCP_HABERES' && (!dto.configuracion.cuenta_cargo || !dto.configuracion.tipo_cuenta_cargo || !dto.configuracion.fecha_pago || !dto.configuracion.referencia))
            throw new BadRequestException( 'BCP requiere cuenta y tipo de cargo, fecha de pago y referencia.');
        if (dto.tipo === 'BCP_HABERES') {
            // Validar que la fecha de pago exista en el calendario y sea hoy o posterior
            try {
                ServerTime.desdeFechaSimple(dto.configuracion.fecha_pago);
            } catch {
                throw new BadRequestException('La fecha de pago BCP no existe en el calendario.');
            }

            // Validar que la fecha de pago sea hoy o posterior
            if (dto.configuracion.fecha_pago! < ServerTime.fechaPeru(new Date()))
                throw new BadRequestException('BCP requiere una fecha de pago de hoy o posterior.');
        }

        // Validaciones específicas para PLAME
        if (dto.tipo === 'PLAME' && dto.configuracion.confirmar_montos_pagados !== true)
            throw new BadRequestException('El contador debe confirmar los montos pagados/descontados para exportar .rem. Cerrar una planilla no confirma su pago.');
        
        // Si en BCP_HABERES se especifica el mapa `tipos_cuenta_abono` y no se filtró por `empleado_id`,
        // se restringe la selección a los colaboradores declarados en dicho mapa para evitar colisiones
        // cuando coexisten los empleados demo de Postman y los empleados demo de n8n en la misma base.
        const empleadosAbono =
            dto.tipo === 'BCP_HABERES' &&
            !dto.empleado_id &&
            dto.configuracion.tipos_cuenta_abono &&
            Object.keys(dto.configuracion.tipos_cuenta_abono).length > 0
                ? Object.keys(dto.configuracion.tipos_cuenta_abono)
                : null;

        // Validaciones específicas para SUNAT
        return this.prisma.$transaction(async (tx) => {
            const planillas = await tx.historial_planillas.findMany({
                where: {
                    periodo: dto.periodo,
                    ...(dto.empleado_id ? { empleado_id: dto.empleado_id } : {}),
                    ...(!dto.empleado_id && empleadosAbono ? { empleado_id: { in: empleadosAbono } } : {}),
                    ...(dto.area_id ? { empleados: { area_id: dto.area_id } } : {})
                },
                select: { id: true, estado: true },
                orderBy: { id: 'asc' },
                take: 1001,
            });
            
            // Validaciones de negocio para la exportación de planillas
            if (!planillas.length)
                throw new BadRequestException('No existen planillas para los filtros solicitados.');
            
            // Limitar la cantidad de planillas a exportar a 1000 para evitar sobrecarga en el sistema
            if (planillas.length > 1000)
                throw new BadRequestException('Divida la exportación por áreas: cada trabajo admite hasta 1000 colaboradores.');
            
            // Validar que todas las planillas estén en estado CONGELADO o DECLARADO antes de permitir la exportación
            if (planillas.some((p) => !['CONGELADO', 'DECLARADO'].includes(p.estado)))
                throw new ConflictException('Debe validar y cerrar todas las planillas seleccionadas antes de exportar.');
            
            // Crear el trabajo de integración en la base de datos dentro de la transacción
            const trabajo = await this.crearEnTransaccion(
                tx,
                `${actor.id}:${dto.idempotencia}`,
                dto.tipo,
                dto.periodo,
                actor.id,
                planillas.map((p) => p.id),
                dto
            );
            return this.resumen(trabajo);
        });
    }

    /**
     * Crea un trabajo de integración en la base de datos dentro de una transacción.
     * @param tx - La transacción de Prisma en la que se ejecuta la creación del trabajo.
     * @param clave - La clave única de idempotencia para el trabajo de integración.
     * @param tipo - El tipo de integración (por ejemplo, BCP_HABERES, PLAME, SUNAT).
     * @param periodo - El periodo de las planillas a exportar.
     * @param usuarioId - El ID del usuario que solicita la creación del trabajo.
     * @param ids - Los IDs de las planillas a exportar.
     * @param solicitud - La solicitud original que contiene los parámetros de la exportación.
     * @returns El trabajo de integración creado o existente si la clave de idempotencia ya estaba registrada.
     * @throws ConflictException si la clave de idempotencia ya identifica otra solicitud diferente.
     * @throws PrismaClientKnownRequestError si ocurre un error de base de datos durante la creación del trabajo.
     */
    async crearEnTransaccion(tx: Prisma.TransactionClient, clave: string, tipo: TipoTrabajoIntegracion, periodo: string | null, usuarioId: string | null, ids: string[], solicitud: unknown) {
        // Canonicalizar la solicitud para garantizar que la misma estructura de datos produzca la misma representación en cadena, lo que permite la idempotencia.
        const texto = jsonCanonicalize(solicitud);
        const existente = await tx.integracionTrabajo.findUnique({where: { clave }});

        // Si ya existe un trabajo con la misma clave de idempotencia, se valida que coincida con la nueva solicitud para garantizar la idempotencia
        if (existente) {
            // Validar que la solicitud existente coincida con la nueva solicitud para garantizar la idempotencia
            if (CryptoUtil.decrypt(existente.solicitud_cifrada) !== texto || existente.tipo !== tipo)
                throw new ConflictException('La misma clave de idempotencia ya identifica otra solicitud.');
            
            return existente;
        }
        try {
            return await tx.integracionTrabajo.create({
                data: {
                    id: IdentityGenerator.generateId(),
                    clave,
                    tipo,
                    periodo,
                    usuario_id: usuarioId,
                    planilla_ids: ids,
                    solicitud_cifrada: CryptoUtil.encrypt(texto),
                },
            });
        } catch (error) {
            // Una carrera de claves únicas revierte la transacción. El cliente reintenta con la MISMA clave.
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
                throw new ConflictException('La solicitud se registró concurrentemente. Consulte o reintente con la misma idempotencia.');
            throw error;
        }
    }

    // Devuelve un resumen del trabajo de integración, incluyendo su ID, tipo, estado y periodo.
    resumen(trabajo: IntegracionTrabajo) {
        return {
            id: trabajo.id,
            tipo: trabajo.tipo,
            estado: trabajo.estado,
            periodo: trabajo.periodo,
            creado_en: trabajo.creado_en,
        };
    }
}