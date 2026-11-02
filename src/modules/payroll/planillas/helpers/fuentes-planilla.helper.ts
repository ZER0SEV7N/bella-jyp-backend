//src/modules/payroll/planillas/helpers/fuentes-planilla.helper.ts
import { ServerTime } from '@/common/utils/server-time';
import { cargarContextoAsistencia, huellaAsistencia } from '@/modules/asistencia/helpers/asistencia-contexto.helper';
import { bloquearEmpleado } from '@/common/utils/transaccion-auditada.util';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Carga las fuentes de datos necesarias para el cálculo de la planilla de un empleado en un período específico.
 * Valida que el período no sea futuro, que la planilla esté abierta, y que la asistencia esté aprobada y vigente.
 * También verifica que los datos financieros y del empleado estén completos y disponibles.
 * @param tx - Cliente de transacción de Prisma para realizar consultas a la base de datos de manera atómica.
 * @param empleadoId - Identificador único del empleado para el cual se cargan las fuentes de planilla.
 * @param periodo - Período de cálculo de la planilla en formato 'YYYY-MM', utilizado para validar y cargar la asistencia y los datos financieros.
 * @returns - Un objeto que contiene la incidencia de asistencia, los datos del empleado, los datos financieros y el contexto de asistencia cargado.
 */
export async function cargarFuentesPlanilla(tx: Prisma.TransactionClient, empleadoId: string, periodo: string) {
    //Valida que el período tenga el formato correcto y que no sea un período futuro.
    ServerTime.validarPeriodo(periodo);

    //Valida que el período no sea un período futuro, comparando con la fecha actual del servidor.
    if (periodo > ServerTime.obtenerPeriodoActual) 
        throw new BadRequestException('No se puede liquidar un período futuro.');
    
    //Bloquea al empleado para evitar modificaciones concurrentes durante la carga de fuentes de planilla.
    await bloquearEmpleado(tx, empleadoId);

    //Verifica si ya existe una planilla para el empleado en el período especificado y que esté abierta.
    const existente = await tx.historial_planillas.findUnique({
        where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } },
        select: { estado: true },
    });

    //Si existe una planilla y no está abierta, lanza una excepción de conflicto indicando el estado actual de la planilla.
    if (existente && existente.estado !== 'ABIERTO') 
        throw new ConflictException(`La planilla está ${existente.estado}.`);
    
    //Carga la incidencia de asistencia del empleado para el período especificado y valida que esté aprobada, vigente, completa y sin pendientes.
    const incidencia = await tx.incidencias_mes.findUnique({ where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } } });

    //Valida que la incidencia de asistencia cumpla con los requisitos necesarios para proceder con el cálculo de la planilla.
    if (!incidencia || incidencia.estado !== 'APROBADO' || !incidencia.vigente || !incidencia.completo || incidencia.pendientes)
        throw new ConflictException('Se requiere una asistencia aprobada, vigente, completa y sin pendientes.');

    //Carga el contexto de asistencia del empleado para el período especificado y valida que la huella de asistencia coincida con la fuente registrada.
    const contexto = await cargarContextoAsistencia(tx, empleadoId, periodo, new Date());
    if (huellaAsistencia(contexto) !== incidencia.fuente_hash)
        throw new ConflictException('La asistencia aprobada no corresponde a sus fuentes actuales.');

    //Carga los datos del empleado y sus datos financieros, incluyendo régimen de pensión, y valida que estén completos y disponibles.
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
            area: { select: { nombre: true } },
        }
    });

    //Carga los datos financieros del empleado, incluyendo régimen de pensión, y valida que estén completos y disponibles.
    const financiero = await tx.dato_financiero.findUnique({
        where: { empleado_id: empleadoId, deleted_at: null },
        include: { regimen_pension: true },
    });

    //Valida que los datos financieros y del empleado estén completos y disponibles, y que el empleado no esté en período de cese sin liquidación.
    if (!financiero || !empleado) throw new NotFoundException('El colaborador necesita datos financieros registrados.');
    
    //Valida que el empleado no esté en período de cese sin liquidación, ya que esto requiere un proceso especial de regularización de beneficios.
    if (empleado.fecha_cese && empleado.fecha_cese.toISOString().slice(0, 7) === periodo)
        throw new BadRequestException('El mes de cese requiere liquidación y regularización de beneficios. Este motor mensual todavía no liquida ceses.');

    return { incidencia, empleado, financiero, contexto };
}
