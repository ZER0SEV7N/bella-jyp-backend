
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiExtension } from '@nestjs/swagger';

export function ApiSwaggerEmpleadosController() {
  return applyDecorators(
    ApiTags('Módulo RRHH - Empleados y Colaboradores'),
    ApiBearerAuth('JWT-auth'),
    ApiExtension('x-roles', ['ADMIN', 'RRHH'])
  );
}

export function ApiSwaggerCrearEmpleado() {
  return applyDecorators(
    ApiOperation({
      summary: 'Crear Colaborador / Legajo',
      description: 'Crea un nuevo legajo maestro. Si no se envía nombre y apellido para DNI de 8 dígitos, se autocompleta vía RENIEC. Incluye datos de filiación, domicilio, ubigeo y jornada.'
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: [
          'cargo_id',
          'area_id',
          'documento_id',
          'estado_empleado_id',
          'nro_documento'
        ],
        properties: {
          cargo_id: { type: 'string', format: 'uuid', example: '018f4a7c-8888-7000-2222-000000000001' },
          area_id: { type: 'string', format: 'uuid', example: '018f4a7c-7777-7000-1111-000000000001' },
          documento_id: { type: 'string', format: 'uuid', example: '018f4a7c-3333-7000-0000-000000000001' },
          estado_empleado_id: { type: 'string', format: 'uuid', example: '018f4a7c-4444-7000-0000-000000000001' },
          jornada_id: { type: 'string', format: 'uuid', nullable: true, example: '018f4a7c-5555-7000-aaaa-000000000001' },
          nro_documento: { type: 'string', example: '70112233' },
          nombre: { type: 'string', nullable: true, example: 'Carlos' },
          apellido: { type: 'string', nullable: true, example: 'Mendoza Pérez' },
          email: { type: 'string', format: 'email', nullable: true, example: 'cmendoza@empresa.pe' },
          telefono: { type: 'string', nullable: true, example: '998877665' },
          sexo: { type: 'string', enum: ['MASCULINO', 'FEMENINO'], nullable: true, example: 'MASCULINO' },
          estado_civil: { type: 'string', enum: ['SOLTERO', 'CASADO', 'CONVIVIENTE', 'DIVORCIADO', 'VIUDO'], default: 'SOLTERO' },
          nacionalidad: { type: 'string', default: 'PERUANA', example: 'PERUANA' },
          direccion: { type: 'string', nullable: true, example: 'Av. Nicolás Arriola 1234' },
          referencia_direccion: { type: 'string', nullable: true, example: 'Frente al parque' },
          ubigeo: { type: 'string', nullable: true, example: '150115', description: 'Código de 6 dígitos SUNAT' },
          distrito: { type: 'string', nullable: true, example: 'La Victoria' },
          provincia: { type: 'string', nullable: true, example: 'Lima' },
          departamento: { type: 'string', nullable: true, example: 'Lima' },
          fecha_nacimiento: { type: 'string', format: 'date-time', nullable: true, example: '1995-05-15T00:00:00.000Z' },
          fecha_inicio: { type: 'string', format: 'date-time', nullable: true, example: '2026-09-01T00:00:00.000Z' },
          afp_fecha_filiacion: { type: 'string', format: 'date-time', nullable: true, example: '2026-09-01T00:00:00.000Z' },
          asig_familiar: { type: 'boolean', default: false }
        }
      }
    }),
    ApiResponse({ status: 201, description: 'Empleado registrado exitosamente.' }),
    ApiResponse({ status: 400, description: 'Documento duplicado o datos inválidos.' }),
    ApiResponse({ status: 404, description: 'Área, cargo, jornada o tipo de documento no encontrado.' })
  );
}

export function ApiSwaggerActualizarEmpleado() {
  return applyDecorators(
    ApiOperation({
      summary: 'Actualizar Colaborador',
      description: 'Actualiza campos biográficos, de filiación, domicilio o reasignación de área/cargo.'
    }),
    ApiParam({ name: 'id', description: 'UUID del colaborador a actualizar.', required: true, schema: { type: 'string', format: 'uuid' } }),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          cargo_id: { type: 'string', format: 'uuid' },
          area_id: { type: 'string', format: 'uuid' },
          jornada_id: { type: 'string', format: 'uuid', nullable: true },
          telefono: { type: 'string' },
          email: { type: 'string', format: 'email' },
          direccion: { type: 'string' },
          asig_familiar: { type: 'boolean' }
        }
      }
    }),
    ApiResponse({ status: 200, description: 'Legajo actualizado exitosamente.' }),
    ApiResponse({ status: 400, description: 'Documento colisiona con otro registro o datos inconsistentes.' }),
    ApiResponse({ status: 404, description: 'Colaborador no encontrado o dado de baja.' })
  );
}

export function ApiSwaggerDesactivarEmpleado() {
  return applyDecorators(
    ApiOperation({
      summary: 'Desactivar Colaborador (Cese / Baja)',
      description: 'Registra la baja laboral estableciendo la fecha de cese actual y aplicando soft delete.'
    }),
    ApiParam({ name: 'id', description: 'UUID del colaborador.', required: true, schema: { type: 'string', format: 'uuid' } }),
    ApiResponse({ status: 200, description: 'Colaborador dado de baja correctamente.' }),
    ApiResponse({ status: 404, description: 'Colaborador no encontrado o ya inactivo.' })
  );
}

export function ApiSwaggerReactivarEmpleado() {
  return applyDecorators(
    ApiOperation({
      summary: 'Reactivar Colaborador',
      description: 'Restaura el estado activo del colaborador limpiando la fecha de cese y preservando sus datos biográficos.'
    }),
    ApiParam({ name: 'id', description: 'UUID del colaborador a reactivar.', required: true, schema: { type: 'string', format: 'uuid' } }),
    ApiResponse({ status: 200, description: 'Colaborador reactivado exitosamente.' }),
    ApiResponse({ status: 400, description: 'El colaborador ya se encuentra activo.' }),
    ApiResponse({ status: 404, description: 'Colaborador no encontrado.' })
  );
}

export function ApiSwaggerListarEmpleados() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar Colaboradores',
      description: 'Obtiene el catálogo paginado de colaboradores con soporte de búsqueda global y filtros.'
    }),
    ApiExtension('x-roles', ['ADMIN', 'RRHH', 'CONTADOR']),
    ApiQuery({ name: 'page', required: false, schema: { type: 'number', default: 1 } }),
    ApiQuery({ name: 'limit', required: false, schema: { type: 'number', default: 10 } }),
    ApiQuery({ name: 'search', required: false, description: 'Coincidencia en DNI, nombre, apellido o email.', schema: { type: 'string' } }),
    ApiQuery({ name: 'area_id', required: false, schema: { type: 'string', format: 'uuid' } }),
    ApiQuery({ name: 'cargo_id', required: false, schema: { type: 'string', format: 'uuid' } }),
    ApiQuery({ name: 'jornada_id', required: false, schema: { type: 'string', format: 'uuid' } }),
    ApiQuery({ name: 'activo', required: false, schema: { type: 'boolean' } }),
    ApiResponse({ status: 200, description: 'Listado obtenido exitosamente.' })
  );
}

export function ApiDetalleEmpleado() {
  return applyDecorators(
    ApiOperation({
      summary: 'Detalle de Colaborador',
      description: 'Obtiene los detalles completos de un colaborador por su ID.'
    }),
    ApiParam({ name: 'id', description: 'UUID del colaborador.', required: true, schema: { type: 'string', format: 'uuid' } }),
    ApiResponse({ status: 200, description: 'Detalles del colaborador obtenidos exitosamente.' }),
    ApiResponse({ status: 400, description: 'ID inválido.' }),
    ApiResponse({ status: 403, description: 'Prohibido. El usuario no tiene el rol necesario para realizar esta acción.' }),
    ApiResponse({ status: 404, description: 'Colaborador no encontrado.' })
  );
}
export function ApiSwaggerConfirmarDniDisponible() {
  return applyDecorators(
    ApiOperation({
      summary: 'Verificar disponibilidad de DNI',
      description:
        'Indica si ya existe un colaborador registrado con el número de documento. Si existe, devuelve su id, si está activo y su estado laboral, para que el frontend pueda ofrecer reactivarlo en lugar de crear un duplicado.'
    }),
    ApiParam({
      name: 'nro_documento',
      description: 'Número de documento a verificar.',
      required: true,
      schema: { type: 'string', example: '70112233' }
    }),
    ApiResponse({
      status: 200,
      description: 'Resultado de la verificación.',
      content: {
        'application/json': {
          examples: {
            disponible: {
              summary: 'No existe colaborador con ese documento',
              value: { disponible: true }
            },
            noDisponible: {
              summary: 'Ya existe un colaborador con ese documento',
              value: {
                disponible: false,
                empleadoExiste: {
                  id: '018f4a7c-1111-7000-aaaa-000000000001',
                  activo: true,
                  estado_laboral: 'VIGENTE'
                }
              }
            }
          }
        }
      }
    }),
    ApiResponse({ status: 401, description: 'No autenticado.' }),
    ApiResponse({ status: 403, description: 'Prohibido. El usuario no tiene el rol necesario para realizar esta acción.' })
  );
}

export function ApiSwaggerObtenerDatosReniec() {
  return applyDecorators(
    ApiOperation({
      summary: 'Autocompletar datos desde RENIEC',
      description:
        'Consulta RENIEC por DNI (8 dígitos) y devuelve nombre y apellidos para autocompletar el formulario de registro antes de guardar. Los datos no se almacenan. Si RENIEC falla, el frontend debe permitir el ingreso manual.'
    }),
    ApiParam({
      name: 'nro_documento',
      description: 'DNI de 8 dígitos numéricos.',
      required: true,
      schema: { type: 'string', pattern: '^\\d{8}$', minLength: 8, maxLength: 8, example: '70112233' }
    }),
    ApiResponse({
      status: 200,
      description: 'Datos obtenidos desde RENIEC.',
      schema: {
        type: 'object',
        properties: {
          nombre: { type: 'string', example: 'Carlos Alberto' },
          apellido_paterno: { type: 'string', example: 'Mendoza' },
          apellido_materno: { type: 'string', example: 'Pérez' }
        }
      }
    }),
    ApiResponse({ status: 400, description: 'El DNI debe tener exactamente 8 dígitos numéricos.' }),
    ApiResponse({ status: 401, description: 'No autenticado.' }),
    ApiResponse({ status: 403, description: 'Prohibido. El usuario no tiene el rol necesario para realizar esta acción.' }),
    ApiResponse({ status: 404, description: 'El DNI no fue encontrado en RENIEC.' }),
    ApiResponse({ status: 408, description: 'RENIEC tardó demasiado en responder (timeout de 5 s).' }),
    ApiResponse({ status: 429, description: 'Demasiadas consultas. Intente nuevamente en unos minutos.' }),
    ApiResponse({ status: 502, description: 'Servicio de RENIEC no disponible temporalmente.' })
  );
}
export function ApiSwaggerCrearEmpleadoCompleto() {
  return applyDecorators(
    ApiOperation({
      summary: 'Crear Colaborador Completo',
      description:
        'Registra en una sola operación atómica el legajo, los datos financieros (cuentas y CCI encriptados) y los derechohabientes. Si no se envía nombre y apellido para un DNI de 8 dígitos, se autocompleta vía RENIEC. Para ver los datos antes de guardar, use GET dni/datos-reniec/:nro_documento.'
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['datosEmpleado', 'datosFinanciero'],
        properties: {
          datosEmpleado: {
            type: 'object',
            required: ['cargo_id', 'area_id', 'documento_id', 'nro_documento', 'fecha_inicio'],
            properties: {
              cargo_id: { type: 'string', format: 'uuid' },
              area_id: { type: 'string', format: 'uuid' },
              documento_id: { type: 'string', format: 'uuid' },
              jornada_id: { type: 'string', format: 'uuid', nullable: true },
              nro_documento: { type: 'string', example: '70112233' },
              nombre: { type: 'string', nullable: true, example: 'Carlos' },
              apellido: { type: 'string', nullable: true, example: 'Mendoza Pérez' },
              email: { type: 'string', format: 'email', example: 'cmendoza@empresa.pe' },
              telefono: { type: 'string', example: '998877665' },
              sexo: { type: 'string', enum: ['MASCULINO', 'FEMENINO'] },
              estado_civil: { type: 'string', enum: ['SOLTERO', 'CASADO', 'CONVIVIENTE', 'DIVORCIADO', 'VIUDO'], default: 'SOLTERO' },
              nacionalidad: { type: 'string', default: 'PERUANA' },
              direccion: { type: 'string', example: 'Av. Nicolás Arriola 1234' },
              referencia_direccion: { type: 'string', example: 'Frente al parque' },
              ubigeo: { type: 'string', example: '150115', description: 'Código de 6 dígitos' },
              distrito: { type: 'string', example: 'La Victoria' },
              provincia: { type: 'string', example: 'Lima' },
              departamento: { type: 'string', example: 'Lima' },
              fecha_nacimiento: { type: 'string', format: 'date-time', example: '1995-05-15T00:00:00.000Z' },
              fecha_inicio: { type: 'string', format: 'date-time', example: '2026-09-01T00:00:00.000Z' },
              afp_fecha_filiacion: { type: 'string', format: 'date-time', nullable: true },
              asig_familiar: { type: 'boolean', default: false }
            }
          },
          datosFinanciero: {
            type: 'object',
            required: ['id_regimen', 'sueldo_basico', 'regimen_salud'],
            properties: {
              id_regimen: { type: 'string', format: 'uuid' },
              id_tipo_afp: { type: 'string', format: 'uuid', nullable: true },
              sueldo_basico: { type: 'number', example: 2500 },
              cuspp: { type: 'string', nullable: true },
              tipo_comision: { type: 'string', nullable: true },
              id_banco_sueldo: { type: 'string', format: 'uuid', nullable: true },
              tipo_cuenta_sueldo: { type: 'string', nullable: true },
              nro_cuenta_sueldo: { type: 'string', nullable: true },
              cci_sueldo: { type: 'string', nullable: true },
              id_banco_cts: { type: 'string', format: 'uuid', nullable: true },
              tipo_cuenta_cts: { type: 'string', nullable: true },
              nro_cuenta_cts: { type: 'string', nullable: true },
              cci_cts: { type: 'string', nullable: true },
              regimen_salud: { type: 'string' },
              eps_nombre: { type: 'string', nullable: true },
              eps_plan: { type: 'string', nullable: true },
              eps_costo_adicional: { type: 'number', default: 0 }
            }
          },
          derechosHabientes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                documento_id: { type: 'string', format: 'uuid' },
                nro_documento: { type: 'string' },
                nombres: { type: 'string' },
                apellidos: { type: 'string' },
                vinculo: { type: 'string', example: 'HIJO_MENOR' },
                estado_civil: { type: 'string' },
                sexo: { type: 'string', enum: ['MASCULINO', 'FEMENINO'] },
                fecha_nacimiento: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }),
    ApiResponse({ status: 201, description: 'Empleado registrado exitosamente.' }),
    ApiResponse({ status: 400, description: 'Datos inválidos o AFP sin la información requerida.' }),
    ApiResponse({ status: 401, description: 'No autenticado.' }),
    ApiResponse({ status: 403, description: 'Prohibido. El usuario no tiene el rol necesario para realizar esta acción.' }),
    ApiResponse({ status: 404, description: 'Área, cargo, jornada, documento, régimen, AFP o banco no encontrado.' }),
    ApiResponse({ status: 409, description: 'Ya existe un empleado con ese número de documento.' })
  );
}