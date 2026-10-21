//src/modules/asistencia/helpers/asistencia-contexto.helper.ts
import { createHash } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ServerTime } from '@/common/utils/server-time';
import type { ContextoAsistencia, DecisionAsistencia, HorarioDia, JornadaHistorica } from '../domain/asistencia.types';
import { VERSION_MOTOR_ASISTENCIA } from '../domain/calcular-asistencia';

/**
 * Carga el contexto de asistencia para un empleado en un período específico, incluyendo marcaciones, solicitudes, jornadas, decisiones y descansos.
 * Este contexto es utilizado para calcular la asistencia del empleado y generar un resumen de incidencias.
 * @param tx - Instancia de Prisma TransactionClient para realizar consultas a la base de datos dentro de una transacción.
 * @param empleadoId - Identificador del empleado para el cual se desea cargar el contexto de asistencia.
 * @param periodo - Período en formato 'YYYY-MM' para el cual se desea cargar el contexto de asistencia.
 * @param ahora - Fecha y hora actual que se utilizará para determinar el estado de las solicitudes y decisiones.
 * @returns - Promesa que se resuelve con el contexto de asistencia cargado para el empleado en el período especificado.
 * @throws NotFoundException si el empleado no existe o fue eliminado.
 * @throws BadRequestException si el empleado no tiene registrada la fecha de ingreso.
 */
export async function cargarContextoAsistencia(tx: Prisma.TransactionClient, empleadoId: string, periodo: string, ahora: Date): Promise<ContextoAsistencia> {
    //Se valida el período proporcionado y se obtiene el rango de fechas correspondiente al mes.
    const { year, month } = ServerTime.validarPeriodo(periodo);

    //Se obtiene la fecha de inicio y fin del mes para el período especificado, así como el rango completo del mes.
    const primero = ServerTime.desdeFechaSimple(`${periodo}-01`), ultimo = new Date(Date.UTC(year, month, 0));

    //Se busca el empleado en la base de datos para verificar que exista y que no haya sido eliminado.
    const rango = ServerTime.obtenerRangoMes(periodo);

    //Se realiza una consulta a la base de datos para obtener las marcaciones, solicitudes, jornadas, decisiones y descansos del empleado en el período especificado.
    const empleado = await tx.empleados.findUnique({ where: { id: empleadoId }, select: { id: true, fecha_inicio: true, fecha_cese: true, deleted_at: true } });
    //Se lanza una excepción NotFoundException si el empleado no existe o fue eliminado.
    if (!empleado || empleado.deleted_at) 
        throw new NotFoundException('El colaborador no existe o fue eliminado.');

    //Se lanza una excepción BadRequestException si el empleado no tiene registrada la fecha de ingreso.
    if (!empleado.fecha_inicio) 
        throw new BadRequestException('Debe registrar la fecha de ingreso del colaborador antes de calcular su asistencia.');

    //Se ejecutan consultas paralelas para obtener las marcaciones, solicitudes, jornadas, decisiones y descansos del empleado en el período especificado.
    const [marcas, solicitudes, jornadas, decisiones, descansos] = await Promise.all([
        tx.asistencia_marcacion.findMany({ 
            where: { empleado_id: empleadoId, 
                fecha_hora: { gte: rango.inicioMes, lt: rango.inicioSiguienteMes } }, 
                orderBy: [{ fecha_hora: 'asc' }, { id: 'asc' }] }),
        tx.solicitud.findMany({ 
            where: { empleado_id: empleadoId, deleted_at: null, 
                tipo: { in: ['VACACIONES', 'LICENCIA_MEDICA', 'PERMISO', 'JUSTIFICACION_ASISTENCIA'] }, 
                estado: { in: ['PENDIENTE', 'EN_REVISION', 'APROBADA'] }, 
                OR: [{ fecha_inicio: { lte: ultimo }, fecha_fin: { gte: primero } }, { 
                    tipo: 'LICENCIA_MEDICA', 
                    fecha_inicio: { lte: ultimo }, 
                    fecha_fin: { gte: new Date(Date.UTC(year, 0, 1)) } }, { fecha_inicio: null }, { fecha_fin: null }] }, 
                    orderBy: { id: 'asc' } }),
        tx.asistencia_jornada.findMany({ where: { empleado_id: empleadoId, desde: { lte: ultimo } }, orderBy: { desde: 'asc' } }),
        tx.asistencia_decision.findMany({ where: { empleado_id: empleadoId, fecha: { gte: primero, lte: ultimo } }, orderBy: [{ fecha: 'asc' }, { tipo: 'asc' }] }),
        tx.asistencia_calendario.findMany({ where: { activo: true, fecha: { gte: primero, lte: ultimo } }, orderBy: { fecha: 'asc' } })
    ]);

    //Se define una función auxiliar para convertir fechas a formato ISO y manejar valores nulos.
    const civil = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
    
    //Se construye y devuelve el contexto de asistencia para el empleado en el período especificado, incluyendo marcaciones, solicitudes, jornadas, decisiones y descansos.
    return {
        periodo, ahora: ahora.toISOString(), empleado: { id: empleado.id, fecha_inicio: civil(empleado.fecha_inicio), fecha_cese: civil(empleado.fecha_cese) },
        marcaciones: marcas.map(m => ({ id: m.id, fecha_hora: m.fecha_hora.toISOString(), tipo_marcacion: m.tipo_marcacion, metodo: m.metodo })),
        solicitudes: solicitudes.map(s => ({ 
            id: s.id, tipo: s.tipo, estado: s.estado, 
            fecha_inicio: civil(s.fecha_inicio), 
            fecha_fin: civil(s.fecha_fin), 
            hora_inicio: s.hora_inicio, 
            hora_fin: s.hora_fin, 
            efecto_asistencia: s.efecto_asistencia })),
        jornadas: jornadas.map(j => ({ 
            desde: civil(j.desde), 
            horario: j.horario as unknown as HorarioDia[], 
            tolerancia_minutos: j.tolerancia_minutos, 
            politica_tolerancia: j.politica_tolerancia as JornadaHistorica['politica_tolerancia'], 
            minutos_semana: j.minutos_semana })),
        decisiones: decisiones.map(d => ({ fecha: civil(d.fecha), tipo: d.tipo, datos: d.datos as DecisionAsistencia['datos'], motivo: d.motivo })),
        descansos: descansos.map(d => ({ fecha: civil(d.fecha), nombre: d.nombre }))
    };
}

/**
 * Genera un hash único que representa el contexto de asistencia de un empleado en un período específico.
 * Este hash se utiliza para verificar si el contexto ha cambiado desde la última vez que se calculó la asistencia.
 * @param contexto - El contexto de asistencia cargado para el empleado en el período especificado.
 * @returns - Un string que representa el hash SHA-256 del contexto de asistencia, incluyendo la versión del motor de asistencia y los datos relevantes del contexto.
 */
export function huellaAsistencia(contexto: ContextoAsistencia): string {
    const { ahora: _ahora, ...fuentes } = contexto;
    return createHash('sha256').update(JSON.stringify({ version: VERSION_MOTOR_ASISTENCIA, ...fuentes })).digest('hex');
}
