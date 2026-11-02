//src/common/notificaciones/cron/alertas-operativas.cron.ts
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { NotificacionesService } from '../notificaciones.service';

/**
 * Cron Job que se ejecuta diariamente para generar alertas operativas relacionadas con solicitudes, pagos y incidencias.
 * Este servicio utiliza el servicio NotificacionesService para publicar alertas en tiempo real a los usuarios correspondientes.
 * Las alertas se generan según las condiciones específicas de cada módulo (solicitudes, pagos e incidencias) y se envían a los roles de usuario relevantes.
 */
@Injectable()
export class AlertasOperativasCron {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificaciones: NotificacionesService
    ) {}

    /**
     * Cron Job que se ejecuta diariamente a las 6:00 AM (hora de Lima) para generar alertas sobre solicitudes pendientes o próximas a vencer.
     * Calcula la fecha límite para las solicitudes según el valor de la variable de entorno DIAS_AVISO_SOLICITUD (por defecto 2 días).
     * Si hay solicitudes pendientes o próximas a vencer, publica una alerta global a los roles ADMIN y RRHH.
     * @returns - Una promesa que se resuelve cuando la alerta ha sido publicada correctamente o no hay solicitudes pendientes.
     */
    @Cron('0 0 6 * * *', { timeZone: 'America/Lima', waitForCompletion: true })
    async solicitudes(): Promise<void> {
        //Calcula la fecha límite para las solicitudes según el valor de la variable de entorno DIAS_AVISO_SOLICITUD (por defecto 2 días).
        const hoy = ServerTime.obtenerFechaSimpleActual;
        const hasta = new Date(hoy);

        //Aumenta la fecha límite en el número de días especificado en la variable de entorno DIAS_AVISO_SOLICITUD (por defecto 2 días).
        hasta.setUTCDate(hasta.getUTCDate() + Number(process.env.DIAS_AVISO_SOLICITUD ?? 2));
        
        //Cuenta el número total de solicitudes que están pendientes o en revisión y cuya fecha límite sea menor o igual a la fecha calculada.
        const total = await this.prisma.solicitud.count({
            where: { 
                deleted_at: null, 
                estado: { in: ['PENDIENTE', 'EN_REVISION'] }, 
                fecha_limite: { lte: hasta } 
            }
        });
        
        //Si no hay solicitudes pendientes o próximas a vencer, no se publica ninguna alerta.
        if (total === 0) 
            return;

        //Publica una alerta global a los roles ADMIN y RRHH indicando el número de solicitudes pendientes o próximas a vencer.
        await this.notificaciones.publicar({
            titulo: 'Solicitudes por revisar',
            mensaje: `${total} solicitudes tienen plazo vencido o próximo a vencer.`,
            tipo: 'WARNING',
            modulo_origen: 'SOLICITUDES',
            roles_destino: ['ADMIN', 'RRHH'],
        }, `solicitudes:${hoy.toISOString().slice(0, 10)}`); //Clave única para evitar duplicados en el mismo día.
    }

    /**
     * Cron Job que se ejecuta diariamente a las 6:05 AM (hora de Lima) para generar alertas sobre la próxima fecha de pago de planillas.
     * Calcula la fecha de pago según la configuración del sistema y verifica si faltan menos días de los especificados en la variable de entorno DIAS_AVISO_PAGO (por defecto 3 días).
     * Si la fecha de pago está próxima, publica una alerta global a los roles ADMIN y CONTADOR.
     * @returns 
     */
    @Cron('0 5 6 * * *', { timeZone: 'America/Lima', waitForCompletion: true })
    async pago(): Promise<void> {
        //Calcula la fecha de pago según la configuración del sistema 
        //y verifica si faltan menos días de los especificados en la variable de entorno DIAS_AVISO_PAGO (por defecto 3 días).
        const hoy = ServerTime.obtenerFechaSimpleActual;
        const ultimo = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0));
        //Obtiene el día de pago configurado en la variable de entorno DIA_PAGO_PLANILLA (por defecto 'ULTIMO').
        const dia = process.env.DIA_PAGO_PLANILLA ?? 'ULTIMO';
        //Calcula la fecha de pago según el día configurado y la fecha actual.
        const pago = new Date(ultimo);

        //Si el día configurado no es 'ULTIMO', establece la fecha de pago al día especificado, asegurándose de no exceder el último día del mes.
        if (dia !== 'ULTIMO')
            pago.setUTCDate(Math.min(Number(dia), ultimo.getUTCDate()));

        //Calcula la diferencia en días entre la fecha de pago y la fecha actual.
        const faltan = (pago.getTime() - hoy.getTime()) / 86400000;
        
        //Si faltan menos días de los especificados en la variable de entorno DIAS_AVISO_PAGO (por defecto 3 días), 
        //publica una alerta global a los roles ADMIN y CONTADOR indicando la próxima fecha de pago.
        if (faltan < 0 || faltan > Number(process.env.DIAS_AVISO_PAGO ?? 3)) 
            return;

        //Publica una alerta global a los roles ADMIN y CONTADOR indicando la próxima fecha de pago.
        await this.notificaciones.publicar({
            titulo: 'Próxima fecha de pago',
            mensaje: `La fecha configurada de pago es ${pago.toISOString().slice(0, 10)}. Revise el periodo ${ServerTime.obtenerPeriodoActual}.`,
            tipo: 'INFO',
            modulo_origen: 'PLANILLAS',
            roles_destino: ['ADMIN', 'CONTADOR'],
        }, `pago:${hoy.toISOString().slice(0, 10)}` ); //Clave única para evitar duplicados en el mismo día.
    }

    /**
     * Cron Job que se ejecuta diariamente a las 6:10 AM (hora de Lima) para generar alertas sobre incidencias pendientes de aprobar o empleados sin resumen del mes actual.
     * Verifica si hay incidencias pendientes de aprobar en el periodo actual o anterior, así como empleados activos sin resumen del mes actual.
     * Si existen incidencias pendientes o empleados sin resumen, publica una alerta global a los roles ADMIN y RRHH indicando la situación.
     * @returns 
     */
    @Cron('0 10 6 * * *', { timeZone: 'America/Lima', waitForCompletion: true })
    async incidencias(): Promise<void> {
        //Obtiene el periodo actual
        const periodo = ServerTime.obtenerPeriodoActual;
        //Cuenta el número de incidencias pendientes de aprobar en el periodo actual o anterior.
        const pendientes = await this.prisma.incidencias_mes.count({
            where: { periodo: { in: [periodo, ServerTime.obtenerPeriodoAnterior] }, estado: { not: 'APROBADO' } },
        });

        //Cuenta el número de empleados activos que no tienen un resumen de incidencias para el periodo actual.
        const sinResumen = await this.prisma.empleados.count({
            where: {
                activo: true,
                deleted_at: null,
                fecha_inicio: { lte: ServerTime.obtenerFechaSimpleActual },
                incidencias: { none: { periodo } },
            },
        });
        
        //Si no hay incidencias pendientes ni empleados sin resumen, no se publica ninguna alerta.
        if (pendientes + sinResumen === 0) 
            return;

        //Publica una alerta global a los roles ADMIN y RRHH indicando el número de incidencias pendientes y empleados sin resumen del mes actual.
        await this.notificaciones.publicar({
            titulo: 'Incidencias pendientes',
            mensaje: `${pendientes} resúmenes pendientes de aprobar; ${sinResumen} empleados sin resumen del mes actual.`,
            tipo: 'WARNING',
            modulo_origen: 'ASISTENCIA',
            roles_destino: ['ADMIN', 'RRHH'],
        }, `incidencias:${ServerTime.fechaPeru(new Date())}` );
    }
}
