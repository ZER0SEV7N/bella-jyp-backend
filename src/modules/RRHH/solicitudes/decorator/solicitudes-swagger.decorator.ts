//src/modules/RRHH/solicitudes/decorator/solicitudes-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth, ApiParam, ApiConsumes, ApiExtension } from '@nestjs/swagger';

export function ApiSwaggerSolicitudController() {
    return applyDecorators(
        ApiTags('Módulo RRHH - Gestión de Solicitudes y Permisos'),
        ApiBearerAuth('JWT-auth')
    );
}

export function ApiSwaggerCrearSolicitud() {
    return applyDecorators(
        ApiOperation({
            summary: 'Crear Solicitud de Permiso / Vacaciones / Descanso',
            description: 'Registra una solicitud formal de colaborador con generación automática de código correlativo (SOL-YYYY-NNN), cálculo de fecha límite de revisión y soporte para archivo de sustento.'
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
                        example: '018f4a7c-8888-7000-2222-000000000001'
                    },
                    tipo: {
                        type: 'string',
                        enum: ['VACACIONES', 'PERMISO', 'DESCANSO_MEDICO', 'LICENCIA_PATERNIDAD', 'LICENCIA_MATERNIDAD', 'OTRO'],
                        example: 'VACACIONES'
                    },
                    fecha_inicio: {
                        type: 'string',
                        format: 'date',
                        example: '2026-10-01'
                    },
                    fecha_fin: {
                        type: 'string',
                        format: 'date',
                        example: '2026-10-15'
                    },
                    dias_solicitados: {
                        type: 'integer',
                        example: 15,
                        default: 1
                    },
                    motivo: {
                        type: 'string',
                        example: 'Vacaciones correspondientes al periodo 2025-2026'
                    },
                    observacion: {
                        type: 'string',
                        nullable: true,
                        example: 'Coordinado previamente con jefatura de área.'
                    },
                    origen: {
                        type: 'string',
                        enum: ['PORTAL_EMPLEADO', 'RRHH_MANUAL'],
                        default: 'PORTAL_EMPLEADO'
                    },
                    archivo: {
                        type: 'string',
                        format: 'binary',
                        description: 'Archivo adjunto de sustento en formato PDF, PNG o JPG (máx. 5MB).'
                    }
                }
            }
        }),
        ApiResponse({
            status: 201,
            description: 'Solicitud registrada exitosamente en estado PENDIENTE.'
        }),
        ApiResponse({
            status: 400,
            description: 'Rango de fechas inconsistente o datos obligatorios faltantes.'
        }),
        ApiResponse({
            status: 404,
            description: 'Empleado solicitante no encontrado o inactivo.'
        })
    );
}

export function ApiSwaggerObtenerDetalleSolicitud() {
    return applyDecorators(
        ApiOperation({
            summary: 'Obtener Detalle de Solicitud',
            description: 'Recupera la ficha integral de la solicitud por su UUID o código correlativo (ej. SOL-2026-001), calculando antigüedad laboral y alertas de urgencia.'
        }),
        ApiParam({
            name: 'idOCodigo',
            description: 'UUID de la solicitud o código correlativo (ej: SOL-2026-001).',
            example: 'SOL-2026-001'
        }),
        ApiResponse({
            status: 200,
            description: 'Detalle de la solicitud obtenido con éxito.'
        }),
        ApiResponse({
            status: 404,
            description: 'Solicitud no encontrada.'
        }),
    );
}

export function ApiSwaggerAsignarRevision() {
    return applyDecorators(
        ApiOperation({
            summary: 'Tomar Solicitud en Revisión',
            description: 'Asigna la solicitud al usuario autenticado (ADMIN o RRHH) y cambia su estado a EN_REVISION.'
        }),
        ApiExtension('x-roles', ['ADMIN', 'RRHH']),
        ApiParam({
            name: 'id',
            description: 'UUID de la solicitud a tomar en revisión.',
            schema: { type: 'string', format: 'uuid' }
        }),
        ApiResponse({
            status: 200,
            description: 'Solicitud tomada en revisión con éxito.'
        }),
        ApiResponse({
            status: 400,
            description: 'La solicitud ya fue dictaminada o ya está tomada por otro revisor.'
        }),
        ApiResponse({
            status: 404,
            description: 'Solicitud no encontrada.'
        })
    );
}

export function ApiSwaggerEvaluarSolicitud() {
    return applyDecorators(
        ApiOperation({
            summary: 'Evaluar Solicitud (Aprobar o Rechazar)',
            description: 'Dictamina una solicitud en estado PENDIENTE o EN_REVISION. Exige observación obligatoria (mínimo 5 caracteres) en caso de rechazo.'
        }),
        ApiExtension('x-roles', ['ADMIN', 'RRHH']),
        ApiParam({
            name: 'id',
            description: 'UUID de la solicitud a dictaminar.',
            schema: { type: 'string', format: 'uuid' }
        }),
        ApiBody({
            schema: {
                type: 'object',
                required: ['estado'],
                properties: {
                    estado: {
                        type: 'string',
                        enum: ['APROBADA', 'RECHAZADA'],
                        example: 'APROBADA'
                    },
                    observacion: {
                        type: 'string',
                        nullable: true,
                        example: 'Aprobado conforme al rol vacacional programado.'
                    }
                }
            }
        }),
        ApiResponse({
            status: 200,
            description: 'Solicitud evaluada y dictaminada exitosamente.',
        }),
        ApiResponse({
            status: 400,
            description: 'Solicitud ya dictaminada previamente o rechazo sin motivo descriptivo.',
        }),
        ApiResponse({
            status: 404,
            description: 'Solicitud no encontrada.'
        })
    );
}

export function ApiSwaggerAnularSolicitud() {
  return applyDecorators(
    ApiOperation({
      summary: 'Anular Solicitud',
      description:
        'Aplica una baja lógica a una solicitud no aprobada previamente, sellando el motivo de anulación.',
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
            example: 'Colaborador cancela solicitud por reprogramación interna de proyecto.',
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Solicitud anulada correctamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'No se puede anular una solicitud formalmente aprobada.',
    }),
    ApiResponse({
      status: 404,
      description: 'Solicitud no encontrada.',
    }),
  );
}