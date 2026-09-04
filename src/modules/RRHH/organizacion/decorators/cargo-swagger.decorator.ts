// src/modules/RRHH/organizacion/decorators/cargo-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiExtension} from '@nestjs/swagger';

/**
 * Decorador para documentar el controlador de Cargos en Swagger.
 * @requires - JWT Bearer token para autenticación.
 * @requires - Roles: ADMIN, RRHH para autorización.
 */
export function ApiSwaggerCargosController() {
  return applyDecorators(
    ApiTags('Módulo RRHH - Cargos y Puestos de Trabajo'),
    ApiBearerAuth('JWT-auth'),
    ApiExtension('x-roles', ['ADMIN', 'RRHH'])
  );
}

/**
 * Decorador para documentar el endpoint de creación de un cargo en Swagger.
 */
export function ApiSwaggerCrearCargo() {
  return applyDecorators(
    ApiOperation({
      summary: 'Crear Cargo / Puesto de Trabajo',
      description: 'Registra un nuevo cargo dentro de la estructura organizacional, asociándolo a un área y definiendo su banda salarial (sueldo mínimo y sueldo máximo).',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['id_area', 'nombre'],
        properties: {
          id_area: {
            type: 'string',
            format: 'uuid',
            example: '018f4a7c-7777-7000-1111-000000000001',
            description: 'UUID del área organizacional a la que pertenece el cargo.'
          },
          nombre: {
            type: 'string',
            example: 'Analista de Nóminas Senior',
            description: 'Nombre descriptivo del cargo o puesto.'
          },
          descripcion: {
            type: 'string',
            nullable: true,
            example: 'Responsable de la liquidación, fiscalización y cierre de planillas mensuales.',
            description: 'Descripción opcional de las responsabilidades del puesto.'
          },
          sueldo_minimo: {
            type: 'number',
            example: 1500.0,
            default: 1130.0,
            description: 'Sueldo mínimo base o referencial de ingreso para el puesto.'
          },
          sueldo_maximo: {
            type: 'number',
            nullable: true,
            example: 3500.0,
            description: 'Tope máximo o techo de la banda salarial para el cargo.'
          }
        }
      }
    }),
    ApiResponse({
      status: 201,
      description: 'Cargo registrado exitosamente con sus bandas salariales y área asignada.'
    }),
    ApiResponse({
      status: 400,
      description: 'Datos inválidos, nombre duplicado en el área o sueldo máximo menor al mínimo.'
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. Token JWT ausente o inválido.'
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. Se requieren permisos de ADMIN o RRHH.'
    }),
    ApiResponse({
      status: 404,
      description: 'El área especificada no existe o se encuentra inactiva/eliminada.'
    })
  );
}

/**
 * Decorador para documentar el endpoint de actualización de un cargo en Swagger.
 */
export function ApiSwaggerActualizarCargo() {
  return applyDecorators(
    ApiOperation({
      summary: 'Actualizar Cargo',
      description: 'Actualiza los parámetros de un cargo existente (área, nombre, descripción o bandas salariales). Soporta modificaciones parciales.'
    }),
    ApiParam({
      name: 'id',
      description: 'UUID del cargo a actualizar.',
      required: true,
      schema: { type: 'string', format: 'uuid' }
    }),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          id_area: {
            type: 'string',
            format: 'uuid',
            example: '018f4a7c-7777-7000-1111-000000000001',
            description: 'UUID de la nueva área destino (si se desea transferir el cargo).'
          },
          nombre: {
            type: 'string',
            example: 'Especialista Contable y Tributario',
            description: 'Nuevo nombre para el cargo.'
          },
          descripcion: {
            type: 'string',
            nullable: true,
            example: 'Encargado de declaraciones tributarias PLAME y auditoría de beneficios sociales.',
            description: 'Descripción actualizada de las responsabilidades del puesto.'
          },
          sueldo_minimo: {
            type: 'number',
            example: 1800.0,
            description: 'Nuevo sueldo mínimo base para el puesto.'
          },
          sueldo_maximo: {
            type: 'number',
            nullable: true,
            example: 4200.0,
            description: 'Nuevo sueldo máximo para el puesto.'
          }
        }
      }
    }),
    ApiResponse({
      status: 200,
      description: 'Cargo actualizado exitosamente.'
    }),
    ApiResponse({
      status: 400,
      description: 'Datos inválidos, nombre duplicado en el área destino o banda salarial inconsistente.'
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado.'
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. Privilegios insuficientes.'
    }),
    ApiResponse({
      status: 404,
      description: 'Cargo no encontrado o área destino no válida.'
    })
  );
}

/**
 * Decorador para documentar el endpoint de consulta paginada y filtrada de cargos en Swagger.
 */
export function ApiSwaggerListarCargos() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar Cargos',
      description: 'Obtiene el catálogo de cargos paginado, permitiendo realizar búsquedas por término y filtrar por área organizacional y estado.',
    }),
    ApiExtension('x-roles', ['ADMIN', 'RRHH', 'CONTADOR']),
    ApiQuery({
      name: 'page',
      description: 'Número de página.',
      required: false,
      schema: { type: 'number', default: 1 }
    }),
    ApiQuery({
      name: 'limit',
      description: 'Cantidad de registros por página.',
      required: false,
      schema: { type: 'number', default: 10 }
    }),
    ApiQuery({
      name: 'search',
      description: 'Término de búsqueda para filtrar por coincidencia en nombre o descripción del cargo.',
      required: false,
      schema: { type: 'string' }
    }),
    ApiQuery({
      name: 'id_area',
      description: 'Filtra cargos pertenecientes a un área específica.',
      required: false,
      schema: { type: 'string', format: 'uuid' }
    }),
    ApiQuery({
      name: 'activo',
      description: 'Filtra por estado activo o inactivo.',
      required: false,
      schema: { type: 'boolean' }
    }),
    ApiResponse({
      status: 200,
      description: 'Listado de cargos paginado obtenido exitosamente.'
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado.'
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido.'
    }),
  );
}

/**
 * Decorador para documentar la desactivación lógica (Soft Delete) de un cargo.
 */
export function ApiSwaggerDesactivarCargo() {
  return applyDecorators(
    ApiOperation({
      summary: 'Desactivar Cargo (Baja Lógica)',
      description: 'Desactiva un cargo organizacional. Bloquea la acción si existen colaboradores activos asignados actualmente a este puesto.'
    }),
    ApiParam({
      name: 'id',
      description: 'UUID del cargo a desactivar.',
      required: true,
      schema: { type: 'string', format: 'uuid' }
    }),
    ApiResponse({
      status: 200,
      description: 'Cargo desactivado exitosamente.'
    }),
    ApiResponse({
      status: 400,
      description: 'Operación bloqueada. Existen empleados activos asignados a este cargo.'
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado.'
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido.'
    }),
    ApiResponse({
      status: 404,
      description: 'Cargo no encontrado o ya eliminado.'
    })
  );
}

/**
 * Decorador para documentar la reactivación de un cargo previamente desactivado.
 */
export function ApiSwaggerReactivarCargo() {
  return applyDecorators(
    ApiOperation({
      summary: 'Reactivar Cargo',
      description: 'Reactiva un cargo previamente dado de baja lógica. Valida que el área a la que pertenece se encuentre activa.'
    }),
    ApiParam({
      name: 'id',
      description: 'UUID del cargo a reactivar.',
      required: true,
      schema: { type: 'string', format: 'uuid' }
    }),
    ApiResponse({
      status: 200,
      description: 'Cargo reactivado exitosamente.'
    }),
    ApiResponse({
      status: 400,
      description: 'El cargo ya está activo o el área matriz se encuentra inactiva.'
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado.'
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido.'
    }),
    ApiResponse({
      status: 404,
      description: 'Cargo no encontrado.'
    })
  );
}