//src/modules/RRHH/datoFinanciero/decorators/datoFinanciero-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiErroresOperacion,
  ApiIdentificador,
  ApiOperacionDocumentada,
} from '@/common/decorators/api-contrato.decorator';
import {
  ActualizarDatoFinancieroSchema,
  CrearDatoFinancieroSchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';

const ROLES_LECTURA = ['ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE'];
const ROLES_CREACION = ['ADMIN', 'CONTADOR', 'RRHH'];
const ROLES_ACTUALIZACION = ['ADMIN', 'RRHH'];

const respuestaMutacionDatoFinanciero: SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    empleado_id: { type: 'string', format: 'uuid' },
    mensaje: { type: 'string' },
  },
};

/**
 * Configura la etiqueta Swagger, la autenticación Bearer y los errores comunes para datos financieros.
 */
export function ApiSwaggerDatoFinancieroController() {
  return applyDecorators(
    ApiTags('RRHH - Datos Financieros'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Documenta `GET /api/v1/RRHH/dato-financiero/empleado/:idEmpleado`.
 */
export function ApiSwaggerObtenerDatoFinanciero() {
  return applyDecorators(
    ApiIdentificador('idEmpleado'),
    ApiOperacionDocumentada({
      summary: 'Obtener ficha financiera del empleado',
      description:
        'Recupera el registro financiero activo del colaborador desencriptando en memoria las cuentas y CCI para devolverlos enmascarados (`cuspp` con los últimos 3 caracteres visibles y cuentas/CCI con los últimos 4 dígitos visibles).',
      roles: ROLES_LECTURA,
      respuesta: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          empleado_id: { type: 'string', format: 'uuid' },
          id_regimen: { type: 'string', format: 'uuid' },
          regimen_nombre: { type: 'string', nullable: true },
          id_tipo_afp: { type: 'string', format: 'uuid', nullable: true },
          afp_nombre: { type: 'string', nullable: true },
          cuspp: { type: 'string', nullable: true },
          tipo_comision: {
            type: 'string',
            enum: ['FLUJO', 'MIXTA'],
            nullable: true,
          },
          sueldo_basico: { type: 'number' },
          id_banco_sueldo: { type: 'string', format: 'uuid', nullable: true },
          banco_sueldo_nombre: { type: 'string', nullable: true },
          tipo_cuenta_sueldo: {
            type: 'string',
            enum: ['SUELDO', 'AHORROS', 'CORRIENTE'],
          },
          nro_cuenta_sueldo: { type: 'string', nullable: true },
          cci_sueldo: { type: 'string', nullable: true },
          id_banco_cts: { type: 'string', format: 'uuid', nullable: true },
          banco_cts_nombre: { type: 'string', nullable: true },
          tipo_cuenta_cts: {
            type: 'string',
            enum: ['SUELDO', 'AHORROS', 'CORRIENTE'],
          },
          nro_cuenta_cts: { type: 'string', nullable: true },
          cci_cts: { type: 'string', nullable: true },
          regimen_salud: {
            type: 'string',
            enum: ['ESSALUD_REGULAR', 'EPS', 'ESSALUD_Y_EPS', 'SCTR'],
          },
          eps_nombre: { type: 'string', nullable: true },
          eps_plan: { type: 'string', nullable: true },
          eps_costo_adicional: { type: 'number' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
    })
  );
}

/**
 * Documenta `POST /api/v1/RRHH/dato-financiero`.
 */
export function ApiSwaggerCrearDatoFinanciero() {
  return applyDecorators(
    ApiContratoBody(CrearDatoFinancieroSchema),
    ApiOperacionDocumentada({
      summary: 'Registrar ficha financiera inicial',
      description:
        'Crea la ficha financiera de un colaborador activo (404 si no existe, 409 si ya tiene ficha). Valida régimen, AFP y bancos existentes, exige AFP/CUSPP/comisión y `afp_fecha_filiacion` en el legajo para SPP/AFP, y cifra cuentas y CCI con AES-256-GCM.',
      roles: ROLES_CREACION,
      status: 201,
      respuesta: respuestaMutacionDatoFinanciero,
    })
  );
}

/**
 * Documenta `PUT /api/v1/RRHH/dato-financiero/empleado/:idEmpleado`.
 */
export function ApiSwaggerActualizarDatoFinanciero() {
  return applyDecorators(
    ApiIdentificador('idEmpleado'),
    ApiContratoBody(ActualizarDatoFinancieroSchema),
    ApiOperacionDocumentada({
      summary: 'Actualizar ficha financiera (Step-Up Auth)',
      description:
        'Actualiza la ficha financiera previa verificación Argon2 de `password_confirmacion` del usuario autenticado (401 si falla). Valida entidades foráneas y coherencia del régimen previsional y re-encripta cuentas y CCI con AES-256-GCM.',
      roles: ROLES_ACTUALIZACION,
      respuesta: respuestaMutacionDatoFinanciero,
    })
  );
}
