// src/modules/rrhh/organizacion/decorators/derechohabiente-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';

/**
 * Decorador de nivel controlador para agrupar las operaciones de derechohabientes en Swagger.
 */
export function ApiSwaggerDerechohabienteController() {
  return applyDecorators(
    ApiTags('RRHH - Derechohabientes'),
    ApiBearerAuth('JWT-auth'),
  );
}

/**
 * Documentación del endpoint POST /api/rrhh/derechohabientes/registrar
 */
export function ApiSwaggerRegistrarDerechohabiente() {
  return applyDecorators(
    ApiOperation({
      summary: 'Registrar un nuevo derechohabiente para un empleado titular',
      description: `
Registra un familiar o dependiente directo con derecho a cobertura de EsSalud/EPS conforme a la normativa laboral peruana.
- **Roles Autorizados**: \`ADMIN\`, \`RRHH\`.
- **Vínculos Contemplados**:
  - \`CONYUGE\`: Cónyuge en matrimonio civil.
  - \`CONCUBINO\`: Unión de hecho declarada formalmente.
  - \`HIJO_MENOR\`: Hijos menores de 18 años.
  - \`HIJO_MAYOR_INCAPACITADO\`: Hijos mayores de edad con incapacidad física/mental total y permanente.
  - \`HIJO_MAYOR_ESTUDIANTE\`: Hijos entre 18 y 28 años cursando estudios superiores continuos.
  - \`MADRE_GESTANTE\`: Cobertura prenatal para cónyuge/concubina.`,
    }),
    ApiBody({
      description: 'Payload validado contra RegistrarDerechohabienteSchema',
      schema: {
        type: 'object',
        required: [
          'empleado_id',
          'documento_id',
          'nro_documento',
          'nombres',
          'apellidos',
          'vinculo',
          'estado_civil',
          'sexo',
          'fecha_nacimiento',
        ],
        properties: {
          empleado_id: {
            type: 'string',
            format: 'uuid',
            example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            description: 'UUID del trabajador titular afiliado',
          },
          documento_id: {
            type: 'string',
            format: 'uuid',
            example: 'b1ffbc88-9c0b-4ef8-bb6d-7cc9bd380b22',
            description: 'UUID del tipo de documento de identidad (DNI, Carné de Extranjería, etc.)',
          },
          nro_documento: {
            type: 'string',
            minLength: 8,
            maxLength: 20,
            example: '74125896',
            description: 'Número de documento oficial del derechohabiente',
          },
          nombres: {
            type: 'string',
            minLength: 2,
            maxLength: 100,
            example: 'Valeria Lucía',
            description: 'Nombres del dependiente',
          },
          apellidos: {
            type: 'string',
            minLength: 2,
            maxLength: 100,
            example: 'Singer Torres',
            description: 'Apellidos del dependiente',
          },
          vinculo: {
            type: 'string',
            enum: [
              'CONYUGE',
              'CONCUBINO',
              'HIJO_MENOR',
              'HIJO_MAYOR_INCAPACITADO',
              'HIJO_MAYOR_ESTUDIANTE',
              'MADRE_GESTANTE',
            ],
            example: 'HIJO_MENOR',
            description: 'Tipo de filiación legal con el titular',
          },
          estado_civil: {
            type: 'string',
            example: 'SOLTERO',
            description: 'Estado civil del derechohabiente',
          },
          sexo: {
            type: 'string',
            enum: ['M', 'F'],
            example: 'F',
            description: 'Sexo biológico registrado',
          },
          fecha_nacimiento: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            example: '2018-05-14',
            description: 'Fecha de nacimiento en formato ISO YYYY-MM-DD',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Derechohabiente registrado satisfactoriamente en estado ACTIVO.',
      schema: {
        example: {
          id: 'c2eebc88-9c0b-4ef8-bb6d-8cc9bd380c33',
          empleado_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          nro_documento: '74125896',
          nombres: 'Valeria Lucía',
          apellidos: 'Singer Torres',
          vinculo: 'HIJO_MENOR',
          estado: 'ACTIVO',
          fecha_nacimiento: '2018-05-14',
          created_at: '2026-09-24T18:00:00.000Z',
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Datos de entrada inválidos (error de validación RFC 7807 por Zod).',
    }),
    ApiResponse({
      status: 403,
      description: 'Acceso denegado: Se requiere rol ADMIN o RRHH.',
    }),
    ApiResponse({
      status: 404,
      description: 'El empleado titular indicado no existe o se encuentra inactivo.',
    }),
    ApiResponse({
      status: 409,
      description: 'Conflicto: Ya existe un derechohabiente registrado con el mismo documento.',
    }),
  );
}

/**
 * Documentación del endpoint POST /api/rrhh/derechohabientes/sustento/abrir (Multipart)
 */
export function ApiSwaggerSubirSustentoDerechohabiente() {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiOperation({
      summary: 'Adjuntar sustento documental probatorio (PDF / Word)',
      description: `
Carga el archivo digital de respaldo legal requerido por SUNAT/T-Registro para acreditar el vínculo del derechohabiente.
- **Roles Autorizados**: \`ADMIN\`, \`RRHH\`.
- **Formatos admitidos**: PDF (\`application/pdf\`), DOC, DOCX.
- **Límite de tamaño**: Máximo 5 MB.
- **Tipos de documento**:
  - \`PARTIDA_NACIMIENTO\`: Para hijos menores.
  - \`PARTIDA_MATRIMONIO\`: Para cónyuges.
  - \`ESCRITURA_CONCUBINATO\`: Acta notarial o judicial de unión de hecho.
  - \`CONSTANCIA_ESTUDIOS\`: Para hijos mayores de 18 años estudiantes (renovación semestral).
  - \`CERTIFICADO_INCAPACIDAD\`: Dictamen médico de EsSalud/MINSA.
  - \`DNI_DERECHOHABIENTE\` / \`OTRO\`.`,
    }),
    ApiBody({
      description: 'Formulario multipart con archivo adjunto y metadatos del sustento',
      schema: {
        type: 'object',
        required: ['file', 'derechohabiente_id', 'tipo_documento'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'Archivo probatorio digitalizado (PDF o Word)',
          },
          derechohabiente_id: {
            type: 'string',
            format: 'uuid',
            example: 'c2eebc88-9c0b-4ef8-bb6d-8cc9bd380c33',
            description: 'UUID del derechohabiente al que pertenece el expediente',
          },
          tipo_documento: {
            type: 'string',
            enum: [
              'PARTIDA_NACIMIENTO',
              'PARTIDA_MATRIMONIO',
              'ESCRITURA_CONCUBINATO',
              'DNI_DERECHOHABIENTE',
              'CONSTANCIA_ESTUDIOS',
              'CERTIFICADO_INCAPACIDAD',
              'OTRO',
            ],
            example: 'PARTIDA_NACIMIENTO',
            description: 'Clasificación del documento probatorio',
          },
          fecha_emision: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            example: '2026-01-15',
            nullable: true,
            description: 'Fecha de expedición del documento oficial (YYYY-MM-DD)',
          },
          fecha_vencimiento: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            example: '2026-12-31',
            nullable: true,
            description: 'Fecha de expiración (obligatoria para constancias de estudio semestrales)',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Sustento documental cargado y almacenado correctamente.',
      schema: {
        example: {
          id: 'd3ffbc88-9c0b-4ef8-bb6d-9cc9bd380d44',
          derechohabiente_id: 'c2eebc88-9c0b-4ef8-bb6d-8cc9bd380c33',
          tipo_documento: 'PARTIDA_NACIMIENTO',
          nombre_archivo: 'partida_nacimiento_valeria.pdf',
          ruta_almacenamiento: '/archivos/sustentos/2026/09/partida_nacimiento_valeria.pdf',
          fecha_emision: '2026-01-15',
          fecha_vencimiento: null,
          created_at: '2026-09-24T18:05:00.000Z',
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Archivo ausente, extensión de archivo no permitida o metadatos inválidos.',
    }),
    ApiResponse({
      status: 403,
      description: 'Acceso denegado: Se requiere rol ADMIN o RRHH.',
    }),
    ApiResponse({
      status: 404,
      description: 'El derechohabiente especificado no existe o se encuentra inactivo.',
    }),
  );
}

/**
 * Documentación del endpoint GET /api/rrhh/derechohabientes/empleado/:empleadoId
 */
export function ApiSwaggerListarPorEmpleado() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar derechohabientes de un empleado titular',
      description: `
Devuelve todos los dependientes vinculados al trabajador titular, detallando su parentesco, estado actual y sustentos cargados.
- **Roles Autorizados**: \`ADMIN\`, \`RRHH\`.`,
    }),
    ApiParam({
      name: 'empleadoId',
      type: 'string',
      format: 'uuid',
      description: 'UUID del trabajador titular',
      example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    }),
    ApiResponse({
      status: 200,
      description: 'Lista de dependientes recuperada exitosamente.',
      schema: {
        example: [
          {
            id: 'c2eebc88-9c0b-4ef8-bb6d-8cc9bd380c33',
            documento_id: 'b1ffbc88-9c0b-4ef8-bb6d-7cc9bd380b22',
            tipo_documento_nombre: 'DNI',
            nro_documento: '74125896',
            nombres: 'Valeria Lucía',
            apellidos: 'Singer Torres',
            vinculo: 'HIJO_MENOR',
            estado_civil: 'SOLTERO',
            sexo: 'F',
            fecha_nacimiento: '2018-05-14',
            estado: 'ACTIVO',
            sustentos: [
              {
                id: 'd3ffbc88-9c0b-4ef8-bb6d-9cc9bd380d44',
                tipo_documento: 'PARTIDA_NACIMIENTO',
                nombre_archivo: 'partida_nacimiento_valeria.pdf',
              },
            ],
          },
        ],
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Formato de UUID de empleado inválido.',
    }),
    ApiResponse({
      status: 401,
      description: 'Token JWT ausente o no válido.',
    }),
    ApiResponse({
      status: 403,
      description: 'Acceso denegado.',
    }),
  );
}

/**
 * Documentación del endpoint DELETE /api/rrhh/derechohabientes/:id/desactivar
 */
export function ApiSwaggerDesactivarDerechohabiente() {
  return applyDecorators(
    ApiOperation({
      summary: 'Desactivar un derechohabiente (Baja lógica)',
      description: `
Cambia el estado del dependiente a \`INACTIVO\` para suspender la cobertura de seguro de salud.
- **Roles Autorizados**: \`ADMIN\`, \`RRHH\`.
- **Casos de Uso Típicos**: Hijos que alcanzaron mayoría de edad sin constancia de estudios, disolución conyugal o deceso.`,
    }),
    ApiParam({
      name: 'id',
      type: 'string',
      format: 'uuid',
      description: 'UUID del derechohabiente a desactivar',
      example: 'c2eebc88-9c0b-4ef8-bb6d-8cc9bd380c33',
    }),
    ApiResponse({
      status: 200,
      description: 'Derechohabiente desactivado exitosamente.',
      schema: {
        example: {
          success: true,
          message: 'Derechohabiente desactivado exitosamente.',
          id: 'c2eebc88-9c0b-4ef8-bb6d-8cc9bd380c33',
          estado: 'INACTIVO',
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'UUID no válido.',
    }),
    ApiResponse({
      status: 404,
      description: 'El derechohabiente no existe o ya se encuentra en estado inactivo.',
    }),
  );
}

/**
 * Documentación del endpoint PATCH /api/rrhh/derechohabientes/:id/reactivar
 */
export function ApiSwaggerReactivarDerechohabiente() {
  return applyDecorators(
    ApiOperation({
      summary: 'Reactivar un derechohabiente suspendido',
      description: `
Restablece el estado del dependiente a \`ACTIVO\` tras la presentación de nuevos sustentos (ej. renovación de matrícula universitaria).
- **Roles Autorizados**: \`ADMIN\`, \`RRHH\`.`,
    }),
    ApiParam({
      name: 'id',
      type: 'string',
      format: 'uuid',
      description: 'UUID del derechohabiente a reactivar',
      example: 'c2eebc88-9c0b-4ef8-bb6d-8cc9bd380c33',
    }),
    ApiResponse({
      status: 200,
      description: 'Derechohabiente reactivado con éxito.',
      schema: {
        example: {
          success: true,
          message: 'Derechohabiente reactivado exitosamente.',
          id: 'c2eebc88-9c0b-4ef8-bb6d-8cc9bd380c33',
          estado: 'ACTIVO',
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'UUID no válido.',
    }),
    ApiResponse({
      status: 404,
      description: 'El derechohabiente no existe o ya se encuentra en estado activo.',
    }),
  );
}