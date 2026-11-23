//src/modules/asistencia/decorator/gestion-asistencia-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiContratoQuery,
  ApiErroresOperacion,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import {
  AsignarJornadaAsistenciaSchema,
  CalendarioAsistenciaRespuestaSchema,
  DetalleAsistenciaQuerySchema,
  DiaAdicionalCalendarioSchema,
  ListarCalendarioAsistenciaQuerySchema,
  ListarMarcacionesQuerySchema,
  marcarAsistenciaSchema,
  ResolverDiaAsistenciaSchema,
  ResolverIncidenciaSchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  respuestaDetalleAsistencia,
  respuestaFilaMarcacion,
  respuestaIncidencia,
  respuestaMarcacion,
} from './asistencia-respuestas.swagger';

const consulta = ['ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE'];
const rrhh = ['ADMIN', 'RRHH'];

export function ApiSwaggerGestionAsistenciaController() {
  return applyDecorators(
    ApiTags('Asistencia - Gestión'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

export function ApiSwaggerDetalleAsistencia() {
  return applyDecorators(
    ApiContratoQuery(DetalleAsistenciaQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Consultar detalle diario de asistencia',
      description:
        'Devuelve el último resumen mensual generado junto con las acciones permitidas (aprobar, rechazar, reabrir: null o el motivo de bloqueo, incluida planilla no abierta). No recalcula implícitamente y responde 404 si aún no fue generado.',
      roles: consulta,
      respuesta: respuestaDetalleAsistencia,
    })
  );
}

export function ApiSwaggerResolverDiaAsistencia() {
  return applyDecorators(
    ApiContratoBody(ResolverDiaAsistenciaSchema),
    ApiOperacionDocumentada({
      summary: 'Resolver una incidencia diaria',
      description:
        'Registra o actualiza una decisión AUSENCIA, MARCACIONES o SOBRETIEMPO con motivo y referencia de evidencia. Conserva las marcas originales, rechaza fechas futuras (400) y bloquea períodos con resumen aprobado o planilla cerrada (409).',
      roles: rrhh,
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          empleado_id: { type: 'string', format: 'uuid' },
          fecha: { type: 'string', format: 'date-time' },
          tipo: { type: 'string' },
          datos: { type: 'object', additionalProperties: true },
          motivo: { type: 'string' },
          usuario_id: { type: 'string', format: 'uuid' },
          version: { type: 'integer' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
    })
  );
}

export function ApiSwaggerAsignarJornadaAsistencia() {
  return applyDecorators(
    ApiContratoBody(AsignarJornadaAsistenciaSchema),
    ApiOperacionDocumentada({
      summary: 'Asignar jornada con vigencia histórica',
      description:
        'Asigna una jornada diurna fija desde una fecha posterior o igual al ingreso del colaborador. Rechaza con conflicto (409) si ya existe una asignación desde esa fecha o si hay períodos cerrados (resumen aprobado o planilla no abierta) desde ese mes, y marca como desactualizados los resúmenes pendientes vigentes afectados.',
      roles: rrhh,
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          empleado_id: { type: 'string', format: 'uuid' },
          jornada_id: { type: 'string', format: 'uuid' },
          desde: { type: 'string', format: 'date-time' },
          horario: {
            type: 'array',
            items: { type: 'object', additionalProperties: true },
          },
          politica_tolerancia: { type: 'string', enum: ['COMPLETA', 'EXCESO'] },
          tolerancia_minutos: { type: 'integer' },
          minutos_semana: { type: 'integer' },
          motivo: { type: 'string' },
          usuario_id: { type: 'string', format: 'uuid' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    })
  );
}

export function ApiSwaggerGuardarDescansoAsistencia() {
  return applyDecorators(
    ApiContratoBody(DiaAdicionalCalendarioSchema),
    ApiOperacionDocumentada({
      summary: 'Guardar descanso adicional de calendario',
      description:
        'Registra o actualiza un descanso adicional en el calendario de asistencia. Rechaza con conflicto (409) si el mes tiene resúmenes aprobados o una planilla cerrada, y marca como desactualizados los resúmenes pendientes vigentes del mes.',
      roles: rrhh,
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          fecha: { type: 'string', format: 'date-time' },
          nombre: { type: 'string' },
          motivo: { type: 'string' },
          activo: { type: 'boolean' },
          usuario_id: { type: 'string', format: 'uuid' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
    })
  );
}

/**
 * Documentación Swagger para consultar el calendario anual de asistencia.
 *
 * @returns Decoradores Swagger aplicados al endpoint de listado de calendario.
 */
export function ApiSwaggerListarCalendarioAsistencia() {
  return applyDecorators(
    ApiContratoQuery(ListarCalendarioAsistenciaQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar calendario anual de asistencia',
      description:
        'Devuelve los feriados nacionales calculados por el motor junto con los descansos adicionales registrados para el año e indica qué meses están cerrados.',
      roles: consulta,
      respuesta: esquemaContrato(CalendarioAsistenciaRespuestaSchema),
    })
  );
}

export function ApiSwaggerResolverIncidencia() {
  return applyDecorators(
    ApiContratoBody(ResolverIncidenciaSchema),
    ApiOperacionDocumentada({
      summary: 'Rechazar o reabrir resumen de asistencia',
      description:
        'Exige motivo e invalida el resumen (vigente: false) para requerir su regeneración antes de aprobar. Rechaza con conflicto (409) si la planilla del período no está abierta o si la acción no está permitida según el estado actual del resumen.',
      roles: rrhh,
      status: 201,
      respuesta: respuestaIncidencia,
    })
  );
}

export function ApiSwaggerCrearMarcacion() {
  return applyDecorators(
    ApiContratoBody(marcarAsistenciaSchema),
    ApiOperacionDocumentada({
      summary: 'Registrar marcación manual',
      description:
        'La fecha_hora debe incluir zona horaria, por ejemplo 2026-09-01T09:00:00-05:00. Verifica vínculo laboral vigente en la fecha, rechaza fechas futuras (400), períodos cerrados o aprobados (409) y marcaciones duplicadas (409).',
      roles: consulta,
      respuesta: respuestaMarcacion,
    })
  );
}

export function ApiSwaggerListarMarcaciones() {
  return applyDecorators(
    ApiContratoQuery(ListarMarcacionesQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar marcaciones',
      description:
        'Filtra por colaborador, intervalo de fechas en Lima y tipo de marcación; devuelve una página de resultados ordenada de la más reciente a la más antigua.',
      roles: consulta,
      respuesta: { type: 'array', items: respuestaFilaMarcacion },
      paginada: true,
    })
  );
}
