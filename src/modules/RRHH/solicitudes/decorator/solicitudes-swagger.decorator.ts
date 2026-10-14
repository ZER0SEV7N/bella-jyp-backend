//src/modules/RRHH/solicitudes/decorator/solicitudes-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth, ApiParam, ApiConsumes, ApiExtension } from '@nestjs/swagger';

/**
 * Decorador Swagger para documentar el controlador de solicitudes en OpenAPI.
 */
export function ApiSwaggerSolicitudController() {
  return applyDecorators(
    ApiTags('Módulo RRHH - Gestión de Solicitudes y Permisos'),
    ApiBearerAuth('JWT-auth'),
  );
}

/**
 * Documentación del endpoint de creación de solicitud (compatible con JSON y Multipart).
 */
export function ApiSwaggerCrearSolicitud() {
  return applyDecorators(
    ApiOperation({
      summary: 'Crear Solicitud de Permiso / Vacaciones / Descanso',
      description:
        'Registra una solicitud formal de colaborador con generación automática de código correlativo (SOL-YYYY-NNN). Soporta subida de archivos adjuntos (PDF o Word, máx. 5MB) mediante multipart/form-data.',
    }),
    ApiConsumes('multipart/form-data', 'application/json'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['tipo', 'motivo'],
        properties: {
          empleado_id: {
            type: 'string',
            format: 'uuid',
            description: 'UUID del empleado (opcional; si se omite, se deduce del usuario en sesión).',
            example: '018f4a7c-8888-7000-2222-000000000001',
          },
          tipo: {
            type: 'string',
            enum: ['VACACIONES', 'LICENCIA_MEDICA', 'PERMISO', 'JUSTIFICACION_ASISTENCIA', 'ACTUALIZACION_DATOS', 'ADELANTO_SUELDO', 'RENUNCIA'],
            example: 'VACACIONES',
          },
          fecha_inicio: {
            type: 'string',
            format: 'date',
            example: '2026-10-01',
          },
          fecha_fin: {
            type: 'string',
            format: 'date',
            example: '2026-10-15',
          },
          dias_solicitados: {
            type: 'integer',
            example: 15,
            default: 1,
          },
          motivo: {
            type: 'string',
            example: 'Vacaciones correspondientes al periodo 2025-2026',
          },
          observacion: {
            type: 'string',
            nullable: true,
            example: 'Coordinado previamente con jefatura de área.',
          },
          origen: {
            type: 'string',
            enum: ['PORTAL_EMPLEADO', 'MANUAL_RRHH', 'APLICACION_MOVIL'],
            default: 'PORTAL_EMPLEADO',
          },
          archivo: {
            type: 'string',
            format: 'binary',
            description: 'Archivo de sustento en formato PDF o Word (.doc, .docx), máx. 5MB.',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Solicitud registrada exitosamente en estado PENDIENTE.',
    }),
    ApiResponse({
      status: 400,
      description: 'Datos inválidos, rango de fechas inconsistente o tipo de archivo no permitido.',
    }),
    ApiResponse({
      status: 404,
      description: 'Empleado solicitante no encontrado o inactivo.',
    }),
  );
}

/**
 * Documentación de la consulta detallada de una solicitud por ID o código.
 */
export function ApiSwaggerObtenerDetalleSolicitud() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener Detalle de Solicitud',
      description:
        'Recupera la información integral de una solicitud por su UUID o código correlativo (ej. SOL-2026-001), calculando antigüedad laboral y alertas de urgencia.',
    }),
    ApiParam({
      name: 'idOCodigo',
      description: 'UUID de la solicitud o código correlativo (ej: SOL-2026-001).',
      example: 'SOL-2026-001',
    }),
    ApiResponse({
      status: 200,
      description: 'Detalle de la solicitud obtenido con éxito.',
    }),
    ApiResponse({
      status: 404,
      description: 'Solicitud no encontrada.',
    }),
  );
}

/**
 * Documentación de la toma en revisión de una solicitud.
 */
export function ApiSwaggerAsignarRevision() {
  return applyDecorators(
    ApiOperation({
      summary: 'Tomar Solicitud en Revisión',
      description:
        'Asigna la solicitud al usuario autenticado (ADMIN o RRHH) y cambia su estado a EN_REVISION.',
    }),
    ApiExtension('x-roles', ['ADMIN', 'RRHH']),
    ApiParam({
      name: 'id',
      description: 'UUID de la solicitud a tomar en revisión.',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiResponse({ status: 409, description: 'Solicitud finalizada, tomada por otro usuario o modificada concurrentemente.' }),
    ApiResponse({
      status: 200,
      description: 'Solicitud tomada en revisión exitosamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'Usuario revisor inválido.',
    }),
    ApiResponse({
      status: 404,
      description: 'Solicitud no encontrada.',
    }),
  );
}

/**
 * Documentación de la evaluación formal de la solicitud.
 */
export function ApiSwaggerEvaluarSolicitud() {
  return applyDecorators(
    ApiOperation({
      summary: 'Evaluar Solicitud (Aprobar o Rechazar)',
      description:
        'Dictamina exclusivamente una solicitud EN_REVISION tomada por el usuario autenticado. Exige observación descriptiva (mínimo 5 caracteres) en caso de rechazo.',
    }),
    ApiExtension('x-roles', ['ADMIN', 'RRHH']),
    ApiParam({
      name: 'id',
      description: 'UUID de la solicitud a evaluar.',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['estado'],
        properties: {
          estado: {
            type: 'string',
            enum: ['APROBADA', 'RECHAZADA'],
            example: 'APROBADA',
          },
          observacion: {
            type: 'string',
            nullable: true,
            example: 'Aprobado conforme al rol de descanso programado.',
          },
        },
      },
    }),
    ApiResponse({ status: 409, description: 'Solicitud finalizada, tomada por otro usuario o modificada concurrentemente.' }),
    ApiResponse({
      status: 200,
      description: 'Solicitud evaluada y dictaminada exitosamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'Rechazo sin motivo descriptivo.',
    }),
    ApiResponse({
      status: 404,
      description: 'Solicitud no encontrada.',
    }),
  );
}

/**
 * Documentación de la anulación de una solicitud.
 */
export function ApiSwaggerAnularSolicitud() {
  return applyDecorators(
    ApiOperation({
      summary: 'Anular Solicitud',
      description:
        'Anula una solicitud PENDIENTE o EN_REVISION, exige un motivo y conserva el registro consultable. No modifica deleted_at.',
    }),
    ApiExtension('x-roles', ['ADMIN', 'RRHH']),
    ApiParam({
      name: 'id',
      description: 'UUID de la solicitud a anular.',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['motivo'],
        properties: {
          motivo: {
            type: 'string',
            example: 'Colaborador cancela la solicitud por reprogramación interna de vacaciones.',
          },
        },
      },
    }),
    ApiResponse({ status: 409, description: 'Solicitud finalizada, tomada por otro usuario o modificada concurrentemente.' }),
    ApiResponse({
      status: 200,
      description: 'Solicitud anulada exitosamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'Motivo de anulación inválido.',
    }),
    ApiResponse({
      status: 404,
      description: 'Solicitud no encontrada.',
    }),
  );
}

/** Historial administrativo de una solicitud, incluyendo anulaciones. */
export function ApiSwaggerObtenerHistorialSolicitud() {
    return applyDecorators(
        ApiOperation({ summary: 'Obtener historial de solicitud', description: 'Consulta por UUID o código. El EMPLEADO solo puede consultar su propia solicitud; los registros proceden de audit_log.' }),
        ApiParam({ name: 'idOCodigo', description: 'UUID o código SOL-YYYY-NNN.', example: 'SOL-2026-001' }),
        ApiResponse({ status: 200, description: 'Historial ordenado cronológicamente; puede estar vacío si no hay eventos registrados.' }),
        ApiResponse({ status: 404, description: 'Solicitud inexistente o fuera del acceso del colaborador.' })
    );
}
