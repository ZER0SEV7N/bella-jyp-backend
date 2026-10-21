import { ServerTime } from '@/common/utils/server-time';
import { cargarContextoAsistencia, huellaAsistencia } from '@/modules/asistencia/helpers/asistencia-contexto.helper';
import { bloquearEmpleado } from '@/modules/asistencia/helpers/asistencia-transaccion.helper';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Bloquea el colaborador y comprueba que la asistencia aprobada conserva sus fuentes. */
export async function cargarFuentesPlanilla(tx: Prisma.TransactionClient, empleadoId: string, periodo: string) {
    ServerTime.validarPeriodo(periodo);
    if (periodo > ServerTime.obtenerPeriodoActual) throw new BadRequestException('No se puede liquidar un período futuro.');
    await bloquearEmpleado(tx, empleadoId);
    const existente = await tx.historial_planillas.findUnique({
        where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } },
        select: { estado: true }
    });
    if (existente && existente.estado !== 'ABIERTO') throw new ConflictException(`La planilla está ${existente.estado}.`);
    const incidencia = await tx.incidencias_mes.findUnique({ where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } } });
    if (!incidencia || incidencia.estado !== 'APROBADO' || !incidencia.vigente || !incidencia.completo || incidencia.pendientes)
        throw new ConflictException('Se requiere una asistencia aprobada, vigente, completa y sin pendientes.');
    const contexto = await cargarContextoAsistencia(tx, empleadoId, periodo, new Date());
    if (huellaAsistencia(contexto) !== incidencia.fuente_hash) throw new ConflictException('La asistencia aprobada no corresponde a sus fuentes actuales.');
    const empleado = await tx.empleados.findUnique({
        where: { id: empleadoId },
        select: {
            id: true,
            nombre: true,
            apellido: true,
            nro_documento: true,
            asig_familiar: true,
            fecha_inicio: true,
            fecha_cese: true,
            cargo: { select: { nombre: true } },
            area: { select: { nombre: true } }
        }
    });
    const financiero = await tx.dato_financiero.findUnique({ where: { empleado_id: empleadoId, deleted_at: null }, include: { regimen_pension: true } });
    if (!financiero || !empleado) throw new NotFoundException('El colaborador necesita datos financieros registrados.');
    if (empleado.fecha_cese && empleado.fecha_cese.toISOString().slice(0, 7) === periodo)
        throw new BadRequestException('El mes de cese requiere liquidación y regularización de beneficios. Este motor mensual todavía no liquida ceses.');

    return { incidencia, empleado, financiero };
}
