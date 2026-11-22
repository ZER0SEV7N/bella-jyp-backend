//src/modules/nomina/planillas/decorators/planillas-respuestas.swagger.ts
import type { SchemaObject } from '@nestjs/swagger';
import { estado_planilla_enum } from '@prisma/client';

const monto: SchemaObject = {
  type: 'string',
  example: '1500.0000',
  description: 'Importe decimal serializado como cadena.',
};
const conceptos = [
  'sueldo_base',
  'asignacion_familia',
  'horas_extras_25',
  'horas_extras_35',
  'recargo_nocturno',
  'gratificacion',
  'bonif_extraordinaria',
  'bono_extraordinario',
  'descuento_faltas',
  'descuento_tardanzas',
  'descuento_sin_goce',
  'descuento_dso',
  'descuento_autorizado',
  'descuento_onp',
  'descuento_afp_fondo',
  'descuento_afp_seguro',
  'descuento_afp_comision',
  'descuento_quinta',
  'descuento_adelanto',
  'descuento_eps',
  'aporte_essalud',
  'aporte_vida_ley',
  'total_ingresos',
  'total_descuentos',
  'neto_a_pagar',
  'base_essalud',
  'base_previsional',
];

export const respuestaPlanilla: SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    empleado_id: { type: 'string', format: 'uuid' },
    periodo: { type: 'string', example: '2026-09' },
    dias_laborados: { type: 'integer' },
    version: { type: 'integer' },
    incidencia_version: { type: 'integer', nullable: true },
    fuente_hash: { type: 'string', nullable: true },
    snapshot_calculo: {
      type: 'object',
      nullable: true,
      additionalProperties: true,
      description:
        'Contiene las fuentes, parámetros y resultado conservados del cálculo.',
    },
    validado_por: { type: 'string', format: 'uuid', nullable: true },
    validado_en: { type: 'string', format: 'date-time', nullable: true },
    ...Object.fromEntries(conceptos.map((campo) => [campo, monto])),
    tasa_afp_aplicada: { ...monto, nullable: true },
    estado: { type: 'string', enum: Object.values(estado_planilla_enum) },
    comentarios: { type: 'string', nullable: true },
    activo: { type: 'boolean' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    deleted_at: { type: 'string', format: 'date-time', nullable: true },
  },
};

export const respuestaNovedad: SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    empleado_id: { type: 'string', format: 'uuid' },
    periodo: { type: 'string' },
    tipo: {
      type: 'string',
      enum: [
        'BONO_EXTRAORDINARIO_REMUNERATIVO',
        'DESCUENTO_AUTORIZADO',
        'DESCUENTO_DSO',
      ],
    },
    monto,
    motivo: { type: 'string' },
    referencia_evidencia: { type: 'string' },
    estado: {
      type: 'string',
      enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO'],
    },
    registrado_por: { type: 'string', format: 'uuid' },
    resuelto_por: { type: 'string', format: 'uuid', nullable: true },
    motivo_resolucion: { type: 'string', nullable: true },
    version: { type: 'integer' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

export const respuestaTrabajo: SchemaObject = {
  type: 'object',
  properties: {
    trabajo_id: { type: 'string' },
    estado: {
      type: 'string',
      description:
        'Estado de BullMQ, por ejemplo waiting, active, completed o failed.',
    },
    consulta: { type: 'string' },
  },
};

export const respuestaConsultaTrabajo: SchemaObject = {
  type: 'object',
  properties: {
    trabajo_id: { type: 'string' },
    estado: { type: 'string' },
    progreso: {
      oneOf: [
        { type: 'number' },
        {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            procesados: { type: 'integer' },
            correctos: { type: 'integer' },
            fallidos: { type: 'integer' },
          },
        },
      ],
    },
    resultado: {
      type: 'object',
      nullable: true,
      properties: {
        estado: { type: 'string', enum: ['COMPLETADO', 'PARCIAL', 'FALLIDO'] },
        total: { type: 'integer' },
        correctos: { type: 'integer' },
        fallidos: { type: 'integer' },
        errores: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              empleado_id: { type: 'string' },
              detalle: { type: 'string' },
            },
          },
        },
        errores_truncados: { type: 'boolean' },
      },
    },
    error: { type: 'string', nullable: true },
  },
};
