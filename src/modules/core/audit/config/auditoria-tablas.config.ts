//src/modules/core/audit/config/auditoria-tablas.config.ts

import type {
  AccionVistaAuditoria,
  TipoAfectadoAuditoria,
  TipoCampoAuditoria,
} from '@jyp/shared-contracts';

export type { AccionVistaAuditoria, TipoAfectadoAuditoria, TipoCampoAuditoria };

/** Entidades a las que puede apuntar un campo de tipo `referencia`. */
export type EntidadReferenciaAuditoria =
  | 'empleado'
  | 'area'
  | 'cargo'
  | 'jornada'
  | 'banco'
  | 'afp'
  | 'regimen'
  | 'tipo_documento'
  | 'derechohabiente'
  | 'usuario';

/** Etiqueta legible de cada acción de negocio. */
export const ETIQUETAS_ACCION_AUDITORIA: Record<AccionVistaAuditoria, string> =
  {
    CREACION: 'Creación',
    EDICION: 'Edición',
    BAJA: 'Baja',
    REACTIVACION: 'Reactivación',
    ELIMINACION: 'Eliminación',
  };

/**
 * Cómo se obtiene el afectado de una tabla:
 * - `propio`: el `registro_id` de la fila es el afectado (por ejemplo `empleados`).
 * - `campo`: el afectado sale de un campo de la fila (por ejemplo `empleado_id`).
 * - `derechohabiente`: el campo apunta a un derechohabiente y el afectado es su empleado
 *   (requiere una consulta extra).
 * - `ninguno`: el afectado es la empresa y no tiene id.
 */
export interface OrigenAfectadoAuditoria {
  tipo: TipoAfectadoAuditoria;
  origen: 'propio' | 'campo' | 'derechohabiente' | 'ninguno';
  campo?: string;
}

/** Descripción de un campo de negocio de una tabla auditada. */
export interface CampoAuditoriaConfig {
  etiqueta: string;
  tipo: TipoCampoAuditoria;
  /** Solo en `referencia`: entidad cuyo nombre reemplaza al ID. */
  entidad?: EntidadReferenciaAuditoria;
  /** Solo en `enum`: etiqueta legible de cada valor. Si falta uno, se humaniza el valor. */
  opciones?: Record<string, string>;
  /** El campo no se muestra al usuario (IDs de contexto sin entidad, rutas de archivos). */
  oculto?: boolean;
  /** Solo en `lista`: cómo identificar y describir cada elemento. */
  elemento?: {
    /** Propiedad que identifica al elemento (por ejemplo `dia`). Sin ella se usa la posición. */
    clave?: string;
    /** Etiquetas de los valores de la clave (por ejemplo `LUNES` → `Lunes`). */
    etiquetas?: Record<string, string>;
    /** Campos conocidos del elemento; los demás se muestran con su nombre humanizado. */
    campos?: Record<string, CampoAuditoriaConfig>;
  };
}

/**
 * Plantillas de resumen por acción; admiten `{afectado}`, `{campos}`, `{nombre_del_campo}` y, en
 * campos de tipo `referencia`, `{nombre_del_campo.detalle}` (dato corto del registro referenciado).
 */
export type PlantillasResumenAuditoria = Partial<
  Record<AccionVistaAuditoria, string>
>;

/** Configuración de una tabla auditada visible para RRHH. */
export interface TablaAuditoriaConfig {
  moduloEtiqueta: string;
  afectado: OrigenAfectadoAuditoria;
  campos: Record<string, CampoAuditoriaConfig>;
  resumen: PlantillasResumenAuditoria;
}

const texto = (etiqueta: string): CampoAuditoriaConfig => ({
  etiqueta,
  tipo: 'texto',
});
const fecha = (etiqueta: string): CampoAuditoriaConfig => ({
  etiqueta,
  tipo: 'fecha',
});
const fechaHora = (etiqueta: string): CampoAuditoriaConfig => ({
  etiqueta,
  tipo: 'fecha_hora',
});
const hora = (etiqueta: string): CampoAuditoriaConfig => ({
  etiqueta,
  tipo: 'hora',
});
const booleano = (etiqueta: string): CampoAuditoriaConfig => ({
  etiqueta,
  tipo: 'booleano',
});
const moneda = (etiqueta: string): CampoAuditoriaConfig => ({
  etiqueta,
  tipo: 'moneda',
});
const numero = (etiqueta: string): CampoAuditoriaConfig => ({
  etiqueta,
  tipo: 'numero',
});
const opcion = (
  etiqueta: string,
  opciones: Record<string, string> = {}
): CampoAuditoriaConfig => ({ etiqueta, tipo: 'enum', opciones });
const referencia = (
  etiqueta: string,
  entidad: EntidadReferenciaAuditoria
): CampoAuditoriaConfig => ({ etiqueta, tipo: 'referencia', entidad });
const oculto = (etiqueta: string): CampoAuditoriaConfig => ({
  etiqueta,
  tipo: 'texto',
  oculto: true,
});

const OPCIONES_ESTADO_CIVIL = {
  SOLTERO: 'Soltero',
  CASADO: 'Casado',
  CONVIVIENTE: 'Conviviente',
  DIVORCIADO: 'Divorciado',
  VIUDO: 'Viudo',
};
const OPCIONES_SEXO = { MASCULINO: 'Masculino', FEMENINO: 'Femenino' };
const OPCIONES_TIPO_CUENTA = {
  SUELDO: 'Sueldo',
  AHORROS: 'Ahorros',
  CORRIENTE: 'Corriente',
};
const OPCIONES_DIA = {
  LUNES: 'Lunes',
  MARTES: 'Martes',
  MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves',
  VIERNES: 'Viernes',
  SABADO: 'Sábado',
  DOMINGO: 'Domingo',
};

const CAMPOS_BAJA = {
  activo: booleano('Activo'),
  deleted_at: fechaHora('Fecha de baja'),
};

/**
 * Registro único de las tablas que RRHH puede ver en la auditoría (AUD-F4, AUD-M2).
 * De aquí salen el afectado de cada cambio, las etiquetas de los campos, el tipo de cada valor,
 * las entidades que se traducen a nombres y las plantillas de resumen.
 */
export const TABLAS_AUDITORIA: Record<string, TablaAuditoriaConfig> = {
  area: {
    moduloEtiqueta: 'Áreas',
    afectado: { tipo: 'area', origen: 'propio' },
    campos: {
      nombre: texto('Nombre'),
      descripcion: texto('Descripción'),
      ...CAMPOS_BAJA,
    },
    resumen: {
      CREACION: 'Creó el área {afectado}',
      EDICION: 'Editó el área {afectado}: {campos}',
      BAJA: 'Dio de baja el área {afectado}',
      REACTIVACION: 'Reactivó el área {afectado}',
      ELIMINACION: 'Eliminó el área {afectado}',
    },
  },
  cargo: {
    moduloEtiqueta: 'Cargos',
    afectado: { tipo: 'cargo', origen: 'propio' },
    campos: {
      id_area: referencia('Área', 'area'),
      nombre: texto('Nombre'),
      descripcion: texto('Descripción'),
      sueldo_minimo: moneda('Sueldo mínimo'),
      sueldo_maximo: moneda('Sueldo máximo'),
      ...CAMPOS_BAJA,
    },
    resumen: {
      CREACION: 'Creó el cargo {afectado}',
      EDICION: 'Editó el cargo {afectado}: {campos}',
      BAJA: 'Dio de baja el cargo {afectado}',
      REACTIVACION: 'Reactivó el cargo {afectado}',
      ELIMINACION: 'Eliminó el cargo {afectado}',
    },
  },
  jornada: {
    moduloEtiqueta: 'Jornadas',
    afectado: { tipo: 'jornada', origen: 'propio' },
    campos: {
      nombre: texto('Nombre'),
      descripcion: texto('Descripción'),
      duracion: opcion('Duración', {
        TIEMPO_COMPLETO: 'Tiempo completo',
        TIEMPO_PARCIAL: 'Tiempo parcial',
      }),
      turno: opcion('Turno', {
        MANANA: 'Mañana',
        TARDE: 'Tarde',
        NOCHE: 'Noche',
        MIXTO: 'Mixto',
        ROTATIVO: 'Rotativo',
      }),
      modalidad: opcion('Modalidad', {
        PRESENCIAL: 'Presencial',
        REMOTO: 'Remoto',
        HIBRIDO: 'Híbrido',
      }),
      tolerancia_minutos: numero('Tolerancia (minutos)'),
      total_horas_semana: numero('Horas por semana'),
      ...CAMPOS_BAJA,
    },
    resumen: {
      CREACION: 'Creó la jornada {afectado}',
      EDICION: 'Editó la jornada {afectado}: {campos}',
      BAJA: 'Dio de baja la jornada {afectado}',
      REACTIVACION: 'Reactivó la jornada {afectado}',
      ELIMINACION: 'Eliminó la jornada {afectado}',
    },
  },
  jornada_area: {
    moduloEtiqueta: 'Jornadas',
    afectado: { tipo: 'jornada', origen: 'campo', campo: 'jornada_id' },
    campos: {
      jornada_id: referencia('Jornada', 'jornada'),
      area_id: referencia('Área', 'area'),
    },
    resumen: {
      CREACION: 'Asignó el área {area_id} a la jornada {afectado}',
      EDICION: 'Cambió las áreas de la jornada {afectado}',
      ELIMINACION: 'Quitó el área {area_id} de la jornada {afectado}',
    },
  },
  empleados: {
    moduloEtiqueta: 'Empleados',
    afectado: { tipo: 'empleado', origen: 'propio' },
    campos: {
      cargo_id: referencia('Cargo', 'cargo'),
      area_id: referencia('Área', 'area'),
      documento_id: referencia('Tipo de documento', 'tipo_documento'),
      jornada_id: referencia('Jornada laboral', 'jornada'),
      estado_laboral: opcion('Estado laboral', {
        ACTIVO: 'Activo',
        VACACIONES: 'De vacaciones',
        LICENCIA: 'De licencia',
        CESADO: 'Cesado',
        DESPEDIDO: 'Despedido',
        SUSPENDIDO: 'Suspendido',
      }),
      nombre: texto('Nombre'),
      apellido: texto('Apellido'),
      nro_documento: texto('Número de documento'),
      email: texto('Correo electrónico'),
      telefono: texto('Teléfono'),
      sexo: opcion('Sexo', OPCIONES_SEXO),
      estado_civil: opcion('Estado civil', OPCIONES_ESTADO_CIVIL),
      nacionalidad: texto('Nacionalidad'),
      fecha_nacimiento: fecha('Fecha de nacimiento'),
      direccion: texto('Dirección'),
      referencia_direccion: texto('Referencia de dirección'),
      ubigeo: texto('Ubigeo'),
      distrito: texto('Distrito'),
      provincia: texto('Provincia'),
      departamento: texto('Departamento'),
      fecha_inicio: fecha('Fecha de ingreso'),
      fecha_cese: fecha('Fecha de cese'),
      afp_fecha_filiacion: fecha('Fecha de afiliación AFP'),
      asig_familiar: booleano('Asignación familiar'),
      ...CAMPOS_BAJA,
    },
    resumen: {
      CREACION: 'Registró al empleado {afectado}',
      EDICION: 'Editó los datos de {afectado}: {campos}',
      BAJA: 'Dio de baja a {afectado}',
      REACTIVACION: 'Reactivó a {afectado}',
      ELIMINACION: 'Eliminó el registro de {afectado}',
    },
  },
  contratos: {
    moduloEtiqueta: 'Contratos',
    afectado: { tipo: 'empleado', origen: 'campo', campo: 'empleado_id' },
    campos: {
      empleado_id: referencia('Empleado', 'empleado'),
      estado: opcion('Estado del contrato', {
        VIGENTE: 'Vigente',
        RENOVADO: 'Renovado',
        VENCIDO: 'Vencido',
        ANULADO: 'Anulado',
        FINALIZADO: 'Finalizado',
      }),
      contrato_origen_id: oculto('Contrato de origen'),
      tipo_modalidad: texto('Modalidad de contrato'),
      fecha_inicio: fecha('Fecha de inicio'),
      fecha_fin: fecha('Fecha de fin'),
      renovado: booleano('Renovado'),
      observacion: texto('Observación'),
      url: texto('Archivo del contrato'),
      deleted_at: fechaHora('Fecha de baja'),
    },
    resumen: {
      CREACION: 'Registró un contrato de {afectado}',
      EDICION: 'Editó un contrato de {afectado}: {campos}',
      BAJA: 'Dio de baja un contrato de {afectado}',
      REACTIVACION: 'Reactivó un contrato de {afectado}',
      ELIMINACION: 'Eliminó un contrato de {afectado}',
    },
  },
  derechohabientes: {
    moduloEtiqueta: 'Familiares',
    afectado: { tipo: 'empleado', origen: 'campo', campo: 'empleado_id' },
    campos: {
      empleado_id: referencia('Empleado', 'empleado'),
      documento_id: referencia('Tipo de documento', 'tipo_documento'),
      nro_documento: texto('Número de documento'),
      nombres: texto('Nombres'),
      apellidos: texto('Apellidos'),
      vinculo: opcion('Vínculo familiar', {
        CONYUGE: 'Cónyuge',
        CONCUBINO: 'Concubino',
        HIJO_MENOR: 'Hijo menor',
        HIJO_MAYOR_INCAPACITADO: 'Hijo mayor incapacitado',
        HIJO_MAYOR_ESTUDIANTE: 'Hijo mayor estudiante',
        MADRE_GESTANTE: 'Madre gestante',
      }),
      estado_civil: opcion('Estado civil', OPCIONES_ESTADO_CIVIL),
      sexo: opcion('Sexo', OPCIONES_SEXO),
      fecha_nacimiento: fecha('Fecha de nacimiento'),
      acreditado_essalud: booleano('Acreditado en EsSalud'),
      fecha_alta_seguro: fecha('Fecha de alta en el seguro'),
      ...CAMPOS_BAJA,
    },
    resumen: {
      CREACION: 'Registró a un familiar de {afectado}: {nombres} {apellidos}',
      EDICION: 'Editó un familiar de {afectado}: {campos}',
      BAJA: 'Dio de baja a un familiar de {afectado}',
      REACTIVACION: 'Reactivó a un familiar de {afectado}',
      ELIMINACION: 'Eliminó a un familiar de {afectado}',
    },
  },
  derechohabiente_documentos: {
    moduloEtiqueta: 'Familiares',
    afectado: {
      tipo: 'empleado',
      origen: 'derechohabiente',
      campo: 'derechohabiente_id',
    },
    campos: {
      derechohabiente_id: referencia('Familiar', 'derechohabiente'),
      tipo_documento: opcion('Tipo de documento', {
        PARTIDA_NACIMIENTO: 'Partida de nacimiento',
        PARTIDA_MATRIMONIO: 'Partida de matrimonio',
        ESCRITURA_CONCUBINATO: 'Escritura de concubinato',
        DNI_DERECHOHABIENTE: 'DNI del familiar',
        CONSTANCIA_ESTUDIOS: 'Constancia de estudios',
        CERTIFICADO_INCAPACIDAD: 'Certificado de incapacidad',
        OTRO: 'Otro',
      }),
      nombre_archivo: texto('Nombre del archivo'),
      archivo_url: oculto('Archivo'),
      fecha_emision: fecha('Fecha de emisión'),
      fecha_vencimiento: fecha('Fecha de vencimiento'),
      vigente: booleano('Vigente'),
      deleted_at: fechaHora('Fecha de baja'),
    },
    resumen: {
      CREACION:
        'Subió un documento de {derechohabiente_id} ({derechohabiente_id.detalle}), familiar de {afectado}',
      EDICION:
        'Editó un documento de {derechohabiente_id} ({derechohabiente_id.detalle}), familiar de {afectado}: {campos}',
      BAJA: 'Dio de baja un documento de {derechohabiente_id} ({derechohabiente_id.detalle}), familiar de {afectado}',
      REACTIVACION:
        'Reactivó un documento de {derechohabiente_id} ({derechohabiente_id.detalle}), familiar de {afectado}',
      ELIMINACION:
        'Eliminó un documento de {derechohabiente_id} ({derechohabiente_id.detalle}), familiar de {afectado}',
    },
  },
  dato_financiero: {
    moduloEtiqueta: 'Datos financieros',
    afectado: { tipo: 'empleado', origen: 'campo', campo: 'empleado_id' },
    campos: {
      empleado_id: referencia('Empleado', 'empleado'),
      id_regimen: referencia('Régimen pensionario', 'regimen'),
      id_tipo_afp: referencia('AFP', 'afp'),
      sueldo_basico: moneda('Sueldo básico'),
      cuspp: texto('CUSPP'),
      tipo_comision: texto('Tipo de comisión AFP'),
      id_banco_sueldo: referencia('Banco de haberes', 'banco'),
      tipo_cuenta_sueldo: opcion(
        'Tipo de cuenta de sueldo',
        OPCIONES_TIPO_CUENTA
      ),
      nro_cuenta_sueldo: texto('Cuenta de sueldo'),
      cci_sueldo: texto('CCI de sueldo'),
      id_banco_cts: referencia('Banco de CTS', 'banco'),
      tipo_cuenta_cts: opcion('Tipo de cuenta de CTS', OPCIONES_TIPO_CUENTA),
      nro_cuenta_cts: texto('Cuenta de CTS'),
      cci_cts: texto('CCI de CTS'),
      regimen_salud: opcion('Régimen de salud', {
        ESSALUD_REGULAR: 'EsSalud regular',
        EPS: 'EPS',
        ESSALUD_Y_EPS: 'EsSalud y EPS',
        SCTR: 'SCTR',
      }),
      eps_nombre: texto('Nombre de la EPS'),
      eps_plan: texto('Plan de la EPS'),
      eps_costo_adicional: moneda('Costo adicional EPS'),
      deleted_at: fechaHora('Fecha de baja'),
    },
    resumen: {
      CREACION: 'Registró los datos financieros de {afectado}',
      EDICION: 'Editó los datos financieros de {afectado}: {campos}',
      BAJA: 'Dio de baja los datos financieros de {afectado}',
      REACTIVACION: 'Reactivó los datos financieros de {afectado}',
      ELIMINACION: 'Eliminó los datos financieros de {afectado}',
    },
  },
  solicitud: {
    moduloEtiqueta: 'Solicitudes',
    afectado: { tipo: 'empleado', origen: 'campo', campo: 'empleado_id' },
    campos: {
      codigo: texto('Código'),
      empleado_id: referencia('Empleado', 'empleado'),
      tipo: opcion('Tipo de solicitud', {
        VACACIONES: 'Vacaciones',
        LICENCIA_MEDICA: 'Licencia médica',
        PERMISO: 'Permiso',
        JUSTIFICACION_ASISTENCIA: 'Justificación de asistencia',
        ACTUALIZACION_DATOS: 'Actualización de datos',
        ADELANTO_SUELDO: 'Adelanto de sueldo',
        RENUNCIA: 'Renuncia',
      }),
      estado: opcion('Estado', {
        PENDIENTE: 'Pendiente',
        EN_REVISION: 'En revisión',
        APROBADA: 'Aprobada',
        RECHAZADA: 'Rechazada',
        ANULADA: 'Anulada',
      }),
      fecha_inicio: fecha('Fecha de inicio'),
      fecha_fin: fecha('Fecha de fin'),
      hora_inicio: hora('Hora de inicio'),
      hora_fin: hora('Hora de fin'),
      efecto_asistencia: opcion('Efecto en la asistencia', {
        PENDIENTE_DEFINIR: 'Pendiente de definir',
        CON_GOCE: 'Con goce',
        SIN_GOCE: 'Sin goce',
        SUBSIDIO: 'Subsidio',
      }),
      dias_solicitados: numero('Días solicitados'),
      monto: moneda('Monto'),
      motivo: texto('Motivo'),
      observacion: texto('Observación'),
      sustento_url: oculto('Archivo de sustento'),
      sustento_nombre: texto('Documento de sustento'),
      responsable_id: referencia('Responsable', 'usuario'),
      fecha_limite: fecha('Fecha límite'),
      origen: texto('Origen'),
      deleted_at: fechaHora('Fecha de baja'),
    },
    resumen: {
      CREACION: 'Registró la solicitud {codigo} de {afectado}',
      EDICION: 'Actualizó la solicitud {codigo} de {afectado}: {campos}',
      BAJA: 'Dio de baja la solicitud {codigo} de {afectado}',
      REACTIVACION: 'Reactivó la solicitud {codigo} de {afectado}',
      ELIMINACION: 'Eliminó la solicitud {codigo} de {afectado}',
    },
  },
  asistencia_marcacion: {
    moduloEtiqueta: 'Asistencia',
    afectado: { tipo: 'empleado', origen: 'campo', campo: 'empleado_id' },
    campos: {
      empleado_id: referencia('Empleado', 'empleado'),
      tipo_marcacion: opcion('Tipo de marcación', {
        ENTRADA: 'Entrada',
        SALIDA: 'Salida',
        SALIDA_ALMUERZO: 'Salida a almuerzo',
        ENTRADA_ALMUERZO: 'Regreso de almuerzo',
      }),
      fecha_hora: fechaHora('Fecha y hora'),
      metodo: texto('Método de registro'),
      motivo: texto('Motivo'),
      usuario_id: referencia('Registrado por', 'usuario'),
      importacion_id: oculto('Importación'),
    },
    resumen: {
      CREACION: 'Registró una marcación ({tipo_marcacion}) de {afectado}',
      EDICION: 'Editó una marcación de {afectado}: {campos}',
      ELIMINACION: 'Eliminó una marcación de {afectado}',
    },
  },
  asistencia_jornada: {
    moduloEtiqueta: 'Asistencia',
    afectado: { tipo: 'empleado', origen: 'campo', campo: 'empleado_id' },
    campos: {
      empleado_id: referencia('Empleado', 'empleado'),
      desde: fecha('Vigente desde'),
      jornada_id: referencia('Jornada', 'jornada'),
      politica_tolerancia: opcion('Política de tolerancia', {
        COMPLETA: 'Completa',
        EXCESO: 'Solo el exceso',
      }),
      horario: {
        etiqueta: 'Horario semanal',
        tipo: 'lista',
        elemento: {
          clave: 'dia',
          etiquetas: OPCIONES_DIA,
          campos: {
            laborable: booleano('Día laborable'),
            modalidad: opcion('Modalidad', {
              PRESENCIAL: 'Presencial',
              REMOTO: 'Remoto',
              HIBRIDO: 'Híbrido',
            }),
            entrada: hora('Hora de entrada'),
            salida: hora('Hora de salida'),
            inicio_descanso: hora('Inicio del descanso'),
            fin_descanso: hora('Fin del descanso'),
          },
        },
      },
      tolerancia_minutos: numero('Tolerancia (minutos)'),
      minutos_semana: numero('Minutos por semana'),
      motivo: texto('Motivo'),
      usuario_id: referencia('Registrado por', 'usuario'),
    },
    resumen: {
      CREACION: 'Asignó una jornada a {afectado} desde el {desde}',
      EDICION: 'Editó la jornada asignada a {afectado}: {campos}',
      ELIMINACION: 'Eliminó una jornada asignada a {afectado}',
    },
  },
  asistencia_decision: {
    moduloEtiqueta: 'Asistencia',
    afectado: { tipo: 'empleado', origen: 'campo', campo: 'empleado_id' },
    campos: {
      empleado_id: referencia('Empleado', 'empleado'),
      fecha: fecha('Fecha'),
      tipo: opcion('Tipo de decisión', { SOBRETIEMPO: 'Sobretiempo' }),
      datos: { etiqueta: 'Datos de la decisión', tipo: 'lista' },
      motivo: texto('Motivo'),
      usuario_id: referencia('Registrado por', 'usuario'),
    },
    resumen: {
      CREACION: 'Registró una decisión de asistencia de {afectado} del {fecha}',
      EDICION: 'Editó una decisión de asistencia de {afectado}: {campos}',
      ELIMINACION: 'Eliminó una decisión de asistencia de {afectado}',
    },
  },
  asistencia_calendario: {
    moduloEtiqueta: 'Asistencia',
    afectado: { tipo: 'empresa', origen: 'ninguno' },
    campos: {
      fecha: fecha('Fecha'),
      nombre: texto('Nombre'),
      motivo: texto('Motivo'),
      activo: booleano('Activo'),
      usuario_id: referencia('Registrado por', 'usuario'),
    },
    resumen: {
      CREACION: 'Agregó el día {nombre} ({fecha}) al calendario laboral',
      EDICION: 'Editó el día {nombre} del calendario laboral: {campos}',
      BAJA: 'Quitó el día {nombre} del calendario laboral',
      REACTIVACION: 'Reactivó el día {nombre} del calendario laboral',
      ELIMINACION: 'Eliminó el día {nombre} del calendario laboral',
    },
  },
  incidencias_mes: {
    moduloEtiqueta: 'Asistencia',
    afectado: { tipo: 'empleado', origen: 'campo', campo: 'empleado_id' },
    campos: {
      empleado_id: referencia('Empleado', 'empleado'),
      periodo: texto('Período'),
      dias_trabajados: numero('Días trabajados'),
      faltas: numero('Faltas'),
      minutos_tardanza: numero('Minutos de tardanza'),
      dias_vinculo: numero('Días de vínculo'),
      dias_sin_goce: numero('Días sin goce'),
      minutos_sin_goce: numero('Minutos sin goce'),
      minutos_salida_anticipada: numero('Minutos de salida anticipada'),
      minutos_extras_25: numero('Minutos extras al 25 %'),
      minutos_extras_35: numero('Minutos extras al 35 %'),
      pendientes: numero('Marcaciones pendientes'),
      completo: booleano('Resumen completo'),
      vigente: booleano('Resumen vigente'),
      motivo_revision: texto('Motivo de revisión'),
      aprobado_por: referencia('Aprobado por', 'usuario'),
      aprobado_en: fechaHora('Fecha de aprobación'),
      horas_extras_25: numero('Horas extras al 25 %'),
      horas_extras_35: numero('Horas extras al 35 %'),
      estado: opcion('Estado', {
        PENDIENTE: 'Pendiente',
        APROBADO: 'Aprobado',
        RECHAZADO: 'Rechazado',
      }),
      detalle: { etiqueta: 'Detalle del resumen', tipo: 'lista' },
    },
    resumen: {
      CREACION:
        'Generó el resumen de asistencia de {afectado} del período {periodo}',
      EDICION:
        'Actualizó el resumen de asistencia de {afectado} ({periodo}): {campos}',
      ELIMINACION:
        'Eliminó el resumen de asistencia de {afectado} del período {periodo}',
    },
  },
};

/**
 * Tablas de auditoría visibles para el rol RRHH (AUD-F4). Lista fija y explícita: agregar una
 * entrada a {@link TABLAS_AUDITORIA} no abre la tabla a RRHH sin decidirlo aquí.
 * Excluye tablas de seguridad o sistema como `usuarios` y `tokens_seguridad`.
 */
export const TABLAS_PERMITIDAS_RRHH = [
  'area',
  'cargo',
  'jornada',
  'jornada_area',
  'empleados',
  'contratos',
  'derechohabientes',
  'derechohabiente_documentos',
  'dato_financiero',
  'solicitud',
  'asistencia_marcacion',
  'asistencia_jornada',
  'asistencia_decision',
  'asistencia_calendario',
  'incidencias_mes',
] as const;

/** Plantillas de resumen para tablas sin configuración propia (por ejemplo `usuarios`). */
export const RESUMEN_GENERICO_AUDITORIA: Required<PlantillasResumenAuditoria> =
  {
    CREACION: 'Creó un registro en {modulo}',
    EDICION: 'Editó un registro en {modulo}: {campos}',
    BAJA: 'Dio de baja un registro en {modulo}',
    REACTIVACION: 'Reactivó un registro en {modulo}',
    ELIMINACION: 'Eliminó un registro en {modulo}',
  };

/** Etiquetas de campos de tablas que RRHH no ve pero ADMIN y CONTADOR sí (por ejemplo `usuarios`). */
const ETIQUETAS_TABLAS_NO_RRHH: Record<string, string> = {
  rol: 'Rol del sistema',
};

/**
 * Diccionario plano de etiquetas por nombre de campo, derivado de {@link TABLAS_AUDITORIA}
 * (AUD-M2). Cuando dos tablas llaman distinto a un mismo campo, gana la primera; para la etiqueta
 * exacta de una tabla use {@link obtenerEtiquetaCampoAuditoria}.
 */
export const ETIQUETAS_CAMPOS_AUDITORIA: Record<string, string> = (() => {
  const etiquetas: Record<string, string> = { ...ETIQUETAS_TABLAS_NO_RRHH };
  for (const tabla of Object.values(TABLAS_AUDITORIA)) {
    for (const [campo, config] of Object.entries(tabla.campos)) {
      etiquetas[campo] ??= config.etiqueta;
    }
  }
  return etiquetas;
})();

/**
 * Obtiene la configuración de un campo de una tabla auditada.
 *
 * @param tabla - Nombre técnico de la tabla.
 * @param campo - Nombre técnico del campo.
 * @returns La configuración del campo o `undefined` si no está registrado.
 */
export function obtenerConfigCampoAuditoria(
  tabla: string,
  campo: string
): CampoAuditoriaConfig | undefined {
  return TABLAS_AUDITORIA[tabla]?.campos[campo];
}

/**
 * Obtiene la etiqueta legible de un campo; si no existe, devuelve su nombre técnico para que
 * agregar columnas no rompa la vista (AUD-M2).
 *
 * @param tabla - Nombre técnico de la tabla, o `undefined` si no se conoce.
 * @param campo - Nombre técnico del campo.
 * @returns La etiqueta de la tabla, la etiqueta genérica o el nombre del campo.
 */
export function obtenerEtiquetaCampoAuditoria(
  tabla: string | undefined,
  campo: string
): string {
  const propia = tabla
    ? TABLAS_AUDITORIA[tabla]?.campos[campo]?.etiqueta
    : undefined;
  return propia ?? ETIQUETAS_CAMPOS_AUDITORIA[campo] ?? campo;
}
