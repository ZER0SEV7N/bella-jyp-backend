//src/modules/payroll/datofinanciero/decorators/datofinanciero-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, } from '@nestjs/swagger';
import { ActualizarDatoFinancieroSchema, CrearDatoFinancieroSchema } from '@jyp/shared-contracts';
import { ApiContratoBody} from '@/common/decorators/api-contrato.decorator';

/**
 * Decorador de nivel controlador para agrupar operaciones del módulo financiero y bancario.
 */
export function ApiSwaggerDatoFinancieroController() {
  return applyDecorators(ApiTags('Payroll - Datos Financieros'), ApiBearerAuth('JWT-auth'));
}

/**
 * Documentación del endpoint GET /api/dato-financiero/empleado/:idEmpleado
 */
export function ApiSwaggerObtenerDatoFinanciero() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener expediente financiero y previsional del empleado',
      description: `Recupera la ficha completa bancaria, previsional (AFP/ONP) y de salud (EsSalud/EPS).
- **Roles Autorizados**: \`ADMIN\`, \`CONTADOR\`, \`RRHH\`, \`ASISTENTE\`.
- **Enmascaramiento de Seguridad (Data Masking)**:
  - CUSPP: se enmascaran los dígitos centrales (ej. \`1023****9871\`).
  - Cuentas de Sueldo y CTS: se muestran únicamente los últimos 4 dígitos (ej. \`****4321\`).
  - Códigos Interbancarios (CCI): se protegen mostrando solo los dígitos finales (ej. \`**** **** **** 1234\`).`,
    }),
    ApiParam({
      name: 'idEmpleado',
      type: 'string',
      format: 'uuid',
      description: 'Identificador único (UUID v4) del trabajador',
      example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    }),
    ApiResponse({
      status: 200,
      description: 'Expediente financiero recuperado exitosamente con campos sensibles enmascarados.',
      schema: {
        example: {
          id: 'b1ffbc88-8b0b-4ef8-bb6d-7cc9bd380b22',
          empleado_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          id_regimen: 'c3ffbc88-9c0b-4ef8-bb6d-8cc9bd380c33',
          regimen_nombre: 'SPP - Sistema Privado de Pensiones',
          id_tipo_afp: 'd4ffbc88-9c0b-4ef8-bb6d-9cc9bd380d44',
          afp_nombre: 'AFP Integra',
          cuspp_mascara: '1122****CDE4',
          tipo_comision: 'MIXTA',
          sueldo_basico: 3500.0,
          id_banco_sueldo: 'e5ffbc88-9c0b-4ef8-bb6d-0cc9bd380e55',
          banco_sueldo_nombre: 'Banco de Crédito del Perú (BCP)',
          tipo_cuenta_sueldo: 'SUELDO',
          nro_cuenta_sueldo_mascara: '****2012',
          cci_sueldo_mascara: '**** **** **** 0124',
          id_banco_cts: 'f6ffbc88-9c0b-4ef8-bb6d-1cc9bd380f66',
          banco_cts_nombre: 'Interbank',
          tipo_cuenta_cts: 'AHORROS',
          nro_cuenta_cts_mascara: '****6055',
          cci_cts_mascara: '**** **** **** 9087',
          regimen_salud: 'ESSALUD_Y_EPS',
          eps_nombre: 'Rímac Seguros',
          eps_plan: 'Plan Base Familiar',
          eps_costo_adicional: 145.5,
          created_at: '2026-04-10T14:20:00.000Z',
          updated_at: '2026-09-24T18:00:00.000Z',
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'El parámetro idEmpleado no corresponde a un formato UUID válido.',
    }),
    ApiResponse({
      status: 401,
      description: 'Token JWT ausente, inválido o expirado.',
    }),
    ApiResponse({
      status: 403,
      description: 'Acceso denegado: El usuario autenticado carece del rol necesario.',
    }),
    ApiResponse({
      status: 404,
      description: 'No se encontró ningún registro financiero para el empleado indicado.',
    })
  );
}

/**
 * Documentación del endpoint POST /api/dato-financiero
 */
export function ApiSwaggerCrearDatoFinanciero() {
  return applyDecorators(
    ApiOperation({
      summary: 'Registrar la ficha financiera y bancaria inicial',
      description: `Registra las cuentas de dispersión de fondos, régimen previsional y cobertura de salud de un empleado.
- **Roles Autorizados**: \`ADMIN\`, \`CONTADOR\`, \`RRHH\`.
- **Estructura Bancaria Doble**: Separa de forma explícita la cuenta corriente/ahorros de **Sueldo** mensual frente a la cuenta intangible de **CTS** (depósitos semestrales de mayo y noviembre).
- **Validaciones Normativas Peruanas**:
  - \`cuspp\`: exactamente 12 caracteres alfanuméricos en mayúsculas (regex: \`[0-9A-Z]{12}\`).
  - \`sueldo_basico\`: número decimal positivo estrictamente mayor a 0 y menor a 1,000,000.
  - \`regimen_salud\`: controla aportes según D.L. 26790 (\`ESSALUD_REGULAR\`, \`EPS\`, \`ESSALUD_Y_EPS\`, \`SCTR\`).`,
    }),
    ApiContratoBody(CrearDatoFinancieroSchema),
    ApiResponse({
      status: 201,
      description: 'Expediente financiero registrado con éxito.',
    }),
    ApiResponse({
      status: 400,
      description: 'Error de validación (ZodValidationPipe): Campos requeridos omitidos, sueldo inválido o formato de CUSPP incorrecto.',
    }),
    ApiResponse({
      status: 403,
      description: 'Acceso denegado: El usuario autenticado no cuenta con permisos para crear datos de planilla.',
    }),
    ApiResponse({
      status: 409,
      description: 'Conflicto: Ya existe un registro financiero vinculado a este empleado.',
    })
  );
}

/**
 * Documentación del endpoint PUT /api/dato-financiero/empleado/:idEmpleado
 */
export function ApiSwaggerActualizarDatoFinanciero() {
  return applyDecorators(
    ApiOperation({
      summary: 'Actualizar expediente financiero (Step-Up Authentication)',
      description: `Modifica cuentas bancarias (Sueldo/CTS), condiciones de seguro de salud o esquema previsional.
- **Roles Autorizados**: \`ADMIN\`, \`RRHH\`.
- **Mecanismo de Step-Up Authentication**:
  - Para evitar fraudes de desvío de fondos o transferencias no autorizadas, el campo \`password_confirmacion\` es **estrictamente obligatorio**.
  - El caso de uso verifica mediante **Argon2id** la contraseña del usuario que ejecuta la solicitud (\`req.user.id\`) antes de realizar cualquier actualización en la base de datos.`,
    }),
    ApiParam({
      name: 'idEmpleado',
      type: 'string',
      format: 'uuid',
      description: 'UUID del trabajador cuyo expediente financiero se actualizará',
      example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    }),
    ApiContratoBody(ActualizarDatoFinancieroSchema),
    ApiResponse({
      status: 200,
      description: 'Datos financieros actualizados correctamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'Datos de entrada no conformes con las reglas de validación Zod.',
    }),
    ApiResponse({
      status: 401,
      description: 'Fallo de Step-Up Auth: Contraseña de confirmación incorrecta.',
    }),
    ApiResponse({
      status: 403,
      description: 'Acceso denegado: Se requiere rol ADMIN o RRHH.',
    }),
    ApiResponse({
      status: 404,
      description: 'No se localizó el expediente financiero asociado al empleado.',
    })
  );
}
