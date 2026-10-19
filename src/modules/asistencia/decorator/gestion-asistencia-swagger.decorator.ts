import { ApiContratoBody, ApiContratoQuery, ApiErroresOperacion, ApiOperacionDocumentada } from '@/common/decorators/api-contrato.decorator';
import { AsignarJornadaAsistenciaSchema, DetalleAsistenciaQuerySchema, DiaAdicionalCalendarioSchema, ListarMarcacionesQuerySchema, marcarAsistenciaSchema, ResolverDiaAsistenciaSchema, ResolverIncidenciaSchema } from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { respuestaIncidencia, respuestaMarcacion } from './asistencia-respuestas.swagger';

const consulta = ['ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE'];
const rrhh = ['ADMIN', 'RRHH'];

export function ApiSwaggerGestionAsistenciaController() {
    return applyDecorators(ApiTags('Asistencia - Gestión'), ApiBearerAuth('JWT-auth'), ApiErroresOperacion());
}
export function ApiSwaggerDetalleAsistencia() {
    return applyDecorators(
        ApiContratoQuery(DetalleAsistenciaQuerySchema),
        ApiOperacionDocumentada({
            summary: 'Consultar detalle diario de asistencia',
            description: 'Devuelve el último resumen generado, con sus fuentes y alertas por día. No recalcula implícitamente.',
            roles: consulta,
            respuesta: respuestaIncidencia
        })
    );
}
export function ApiSwaggerResolverDiaAsistencia() {
    return applyDecorators(
        ApiContratoBody(ResolverDiaAsistenciaSchema),
        ApiOperacionDocumentada({
            summary: 'Resolver una incidencia diaria',
            description:
                'Admite decisiones AUSENCIA, MARCACIONES o SOBRETIEMPO. Requiere motivo y referencia de evidencia. Conserva las marcas originales y bloquea fuentes de períodos aprobados o congelados.',
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
                    version: { type: 'integer' }
                }
            }
        })
    );
}
export function ApiSwaggerAsignarJornadaAsistencia() {
    return applyDecorators(
        ApiContratoBody(AsignarJornadaAsistenciaSchema),
        ApiOperacionDocumentada({
            summary: 'Asignar jornada con vigencia histórica',
            description: 'Conserva horario y tolerancia desde una fecha. El alcance actual admite cinco días de ocho horas efectivas y jornada diurna fija.',
            roles: rrhh,
            status: 201,
            respuesta: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    empleado_id: { type: 'string', format: 'uuid' },
                    jornada_id: { type: 'string', format: 'uuid' },
                    desde: { type: 'string', format: 'date-time' },
                    horario: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    politica_tolerancia: { type: 'string', enum: ['COMPLETA', 'EXCESO'] },
                    tolerancia_minutos: { type: 'integer' },
                    minutos_semana: { type: 'integer' },
                    motivo: { type: 'string' }
                }
            }
        })
    );
}
export function ApiSwaggerGuardarDescansoAsistencia() {
    return applyDecorators(
        ApiContratoBody(DiaAdicionalCalendarioSchema),
        ApiOperacionDocumentada({
            summary: 'Guardar descanso adicional de calendario',
            description: 'Registra o actualiza un descanso adicional acordado. Los feriados nacionales se obtienen del calendario del motor.',
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
                    usuario_id: { type: 'string', format: 'uuid' }
                }
            }
        })
    );
}
export function ApiSwaggerResolverIncidencia() {
    return applyDecorators(
        ApiContratoBody(ResolverIncidenciaSchema),
        ApiOperacionDocumentada({
            summary: 'Rechazar o reabrir resumen de asistencia',
            description: 'Exige motivo. Invalida el resumen y requiere regenerarlo antes de aprobar; no permite alterar una planilla congelada.',
            roles: rrhh,
            status: 201,
            respuesta: respuestaIncidencia
        })
    );
}
export function ApiSwaggerCrearMarcacion() {
    return applyDecorators(
        ApiContratoBody(marcarAsistenciaSchema),
        ApiOperacionDocumentada({
            summary: 'Registrar marcación manual',
            description:
                'La fecha_hora debe incluir zona horaria, por ejemplo 2026-09-01T09:00:00-05:00. Exige motivo, conserva al usuario y evita duplicados.',
            roles: consulta,
            respuesta: respuestaMarcacion
        })
    );
}
export function ApiSwaggerListarMarcaciones() {
    return applyDecorators(
        ApiContratoQuery(ListarMarcacionesQuerySchema),
        ApiOperacionDocumentada({
            summary: 'Listar marcaciones',
            description: 'Filtra por colaborador, intervalo de fechas en Lima y tipo de marcación; devuelve una página de resultados.',
            roles: consulta,
            respuesta: { type: 'array', items: respuestaMarcacion },
            paginada: true
        })
    );
}
