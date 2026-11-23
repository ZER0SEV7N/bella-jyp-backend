//src/modules/integraciones/decorators/exportaciones-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiErroresOperacion,
  ApiIdentificador,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import {
  ConsultaTrabajoIntegracionSchema,
  ResumenTrabajoIntegracionSchema,
  SolicitarExportacionSchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtension,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

const rolesExportacion = ['ADMIN', 'CONTADOR'];

/**
 * Decorador de nivel controlador para agrupar las operaciones de exportación e integraciones.
 */
export function ApiSwaggerExportacionesController() {
  return applyDecorators(
    ApiTags('Módulo Integraciones - Exportaciones'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Documenta `POST /api/v1/integraciones/exportaciones`.
 */
export function ApiSwaggerSolicitarExportacion() {
  return applyDecorators(
    ApiContratoBody(SolicitarExportacionSchema),
    ApiOperacionDocumentada({
      summary: 'Solicitar exportación o emisión de archivos',
      description:
        'Crea un trabajo asíncrono en la bandeja de salida para n8n con clave de idempotencia por actor (`idempotencia`). Exige planillas cerradas (CONGELADO o DECLARADO) hasta un máximo de 1000 por trabajo, confirmación explícita para PLAME y datos bancarios de cargo para BCP_HABERES.',
      roles: rolesExportacion,
      status: 202,
      respuesta: esquemaContrato(ResumenTrabajoIntegracionSchema),
    }),
    ApiResponse({
      status: 422,
      description:
        'Canal bancario no homologado (BBVA_HABERES o INTERBANK_HABERES no sustituyen el formato BCP).',
    })
  );
}

/**
 * Documenta `GET /api/v1/integraciones/trabajos/:id`.
 */
export function ApiSwaggerEstadoTrabajoExportacion() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Consultar estado de un trabajo de integración',
      description:
        'Devuelve el estado, marcas de tiempo, intentos, resultado del manifiesto y la bandera `requiere_revision` cuando lleva más de 65 minutos en PROCESANDO. Excluye trabajos internos de recuperación de contraseña.',
      roles: rolesExportacion,
      respuesta: esquemaContrato(ConsultaTrabajoIntegracionSchema),
    })
  );
}

/**
 * Documenta `GET /api/v1/integraciones/trabajos/:id/archivos/:nombre`.
 */
export function ApiSwaggerDescargarArchivoExportacion() {
  return applyDecorators(
    ApiIdentificador(),
    ApiIdentificador('nombre', false),
    ApiOperation({
      summary: 'Descargar archivo generado por una exportación',
      description:
        'Solo disponible cuando el trabajo está COMPLETADO o PARCIAL. Verifica que el archivo pertenezca al manifiesto del trabajo, resida dentro del directorio autorizado y coincida en tamaño y hash SHA-256 antes de enviarlo como adjunto.',
    }),
    ApiExtension('x-roles', rolesExportacion),
    ApiProduces('application/pdf', 'text/plain', 'text/csv', 'message/rfc822'),
    ApiResponse({
      status: 200,
      description:
        'Contenido binario o textual del archivo validado del trabajo, enviado con el Content-Type real registrado en `archivo.tipo`.',
      content: {
        'application/pdf': {
          schema: { type: 'string', format: 'binary' },
        },
        'text/plain': {
          schema: { type: 'string' },
        },
        'text/csv': {
          schema: { type: 'string' },
        },
        'message/rfc822': {
          schema: { type: 'string' },
        },
      },
    })
  );
}
