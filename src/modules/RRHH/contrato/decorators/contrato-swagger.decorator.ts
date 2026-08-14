//src/modules/RRHH/contrato/decorators/contrato.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth, ApiQuery, ApiConsumes, ApiParam } from '@nestjs/swagger';

/**
 * Decorador que agrupa los endpoints del módulo de contratos en la documentación Swagger.
 * Este decorador aplica las etiquetas y configuraciones necesarias para que los endpoints del módulo de contratos se muestren correctamente en la interfaz de Swagger.
 * @returns Un conjunto de decoradores que configuran la documentación Swagger para el módulo de contratos.
 */
export function ApiSwaggerContratoController() {
  return applyDecorators(ApiTags('Módulo Contratos'), ApiBearerAuth('JWT-auth'));
}

/**
 * Decorador que documenta el endpoint de creación de contratos en Swagger.
 * Este decorador aplica las configuraciones necesarias para que el endpoint de creación de contratos se muestre correctamente en la interfaz de Swagger.
 * @returns Un conjunto de decoradores que configuran la documentación Swagger para el endpoint de creación de contratos.
 */
export function ApiSwaggerCrearContrato() {
  return applyDecorators(
    ApiOperation({ summary: 'Crear Contrato (Borrador)', description: 'Registra un nuevo contrato sin PDF adjunto. Queda habilitado para edición.' }),
    ApiBody({ 
      schema: { 
        type: 'object', 
        required: ['empleado_id', 'id_estado', 'fecha_inicio'], 
        properties: { 
          empleado_id: { type: 'string', format: 'uuid' }, 
          id_estado: { type: 'string', format: 'uuid' }, 
          fecha_inicio: { type: 'string', format: 'date', example: '2026-08-01' }, 
          fecha_fin: { type: 'string', format: 'date', example: '2027-08-01' }, 
          tipo_modalidad: { type: 'string', example: 'Plazo Fijo' },
          observacion: { type: 'string' } 
        } 
      } 
    }),
    ApiResponse({ status: 201, description: 'Contrato creado exitosamente.' }),
    ApiResponse({ status: 400, description: 'Error de validación o datos inválidos.' }),
    ApiResponse({ status: 401, description: 'No autorizado. Token inválido o expirado.' }),
    ApiResponse({ status: 403, description: 'Acceso denegado. No tiene permisos para crear contratos.' }),
    ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  );
}

/**
 * Decorador que documenta el endpoint de edición de contratos en Swagger.
 * Este decorador aplica las configuraciones necesarias para que el endpoint de edición de contratos se muestre correctamente en la interfaz de Swagger.
 * @returns Un conjunto de decoradores que configuran la documentación Swagger para el endpoint de edición de contratos.
 */
export function ApiSwaggerEditarContrato() {
  return applyDecorators(
    ApiOperation({ summary: 'Editar Contrato', description: 'Permite editar un contrato SOLO si aún no tiene un PDF subido.' }),
    ApiParam({ name: 'id', description: 'UUID del contrato', type: 'string' })
  );
}

/**
 * Decorador que documenta el endpoint de renovación de contratos en Swagger.
 * Este decorador aplica las configuraciones necesarias para que el endpoint de renovación de contratos se muestre correctamente en la interfaz de Swagger.
 * @returns Un conjunto de decoradores que configuran la documentación Swagger para el endpoint de renovación de contratos.
 */
export function ApiSwaggerRenovarContrato() {
  return applyDecorators(
    ApiOperation({ summary: 'Renovar Contrato (Adenda)', description: 'Cierra el contrato actual y genera un nuevo registro para el siguiente periodo.' }),
    ApiParam({ name: 'id', description: 'UUID del contrato a vencer', type: 'string' }),
    ApiBody({ 
      schema: { 
        type: 'object', 
        required: ['id_estado', 'fecha_inicio'], 
        properties: { 
          id_estado: { type: 'string', format: 'uuid' }, 
          fecha_inicio: { type: 'string', format: 'date' }, 
          fecha_fin: { type: 'string', format: 'date' }
        } 
      } 
    })
  );
}

/**
 * Decorador que documenta el endpoint de anulación de contratos en Swagger.
 * Este decorador aplica las configuraciones necesarias para que el endpoint de anulación de contratos se muestre correctamente en la interfaz de Swagger.
 * @returns Un conjunto de decoradores que configuran la documentación Swagger para el endpoint de anulación de contratos.
 */
export function ApiSwaggerAnularContrato() {
  return applyDecorators(
    ApiOperation({ summary: 'Anular Contrato', description: 'Realiza un soft-delete del contrato.' }),
    ApiParam({ name: 'id', description: 'UUID del contrato', type: 'string' })
  );
}

/**
 * Decorador que documenta el endpoint de listado de contratos de un empleado en Swagger.
 * Este decorador aplica las configuraciones necesarias para que el endpoint de listado de contratos de un empleado se muestre correctamente en la interfaz de Swagger.
 * @returns Un conjunto de decoradores que configuran la documentación Swagger para el endpoint de listado de contratos de un empleado.
 */
export function ApiSwaggerListarContratosEmpleado() {
  return applyDecorators(
    ApiOperation({ summary: 'Historial de Contratos', description: 'Obtiene todos los contratos vinculados a un empleado específico.' }),
    ApiParam({ name: 'empleadoId', description: 'UUID del empleado', type: 'string' })
  );
}

/**
 * Decorador que documenta el endpoint de subida de PDF de un contrato en Swagger.
 * Este decorador aplica las configuraciones necesarias para que el endpoint de subida de PDF de un contrato se muestre correctamente en la interfaz de Swagger.
 * @returns Un conjunto de decoradores que configuran la documentación Swagger para el endpoint de subida de PDF de un contrato.
 */
export function ApiSwaggerSubirPdf() {
  return applyDecorators(
    ApiOperation({ summary: 'Subir PDF del Contrato', description: 'Sube el documento firmado. Al subirlo, el contrato queda congelado (inmutable).' }),
    ApiParam({ name: 'id', description: 'UUID del contrato', type: 'string' }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: { type: 'object', properties: { file: { type: 'string', format: 'binary', description: 'Documento PDF' } } },
    })
  );
}

/**
 * Decorador que documenta el endpoint de descarga de PDF de un contrato en Swagger.
 * Este decorador aplica las configuraciones necesarias para que el endpoint de descarga de PDF de un contrato se muestre correctamente en la interfaz de Swagger.
 * @returns Un conjunto de decoradores que configuran la documentación Swagger para el endpoint de descarga de PDF de un contrato.
 */
export function ApiSwaggerDescargarPdf() {
  return applyDecorators(
    ApiOperation({ summary: 'Descargar Documento', description: 'Obtiene el archivo físico del contrato.' }),
    ApiParam({ name: 'filename', description: 'Nombre del archivo generado por el sistema', type: 'string' })
  );
}