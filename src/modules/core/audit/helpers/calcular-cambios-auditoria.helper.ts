//src/modules/core/audit/helpers/calcular-cambios-auditoria.helper.ts
import { CAMPOS_SENSIBLES_AUDITORIA } from '@/common/utils/audit-snaphot.util';

/**
 * Tablas de auditoría visibles para el rol RRHH (AUD-F4).
 * Excluye explícitamente tablas de seguridad/sistema como `usuarios` y `tokens_seguridad`.
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

/** Campos técnicos internos que se omiten al calcular las diferencias legibles para el usuario (AUD-M2). */
const CAMPOS_TECNICOS_IGNORADOS = new Set([
  'id',
  'created_at',
  'updated_at',
  'creado_en',
  'actualizado_en',
  'version',
  'estado_sincronizacion',
  'fuente_hash',
  'password_hash',
  'token_hash',
]);

/** Campos financieros o reservados que se reportan con `protegido: true` sin mostrar su valor bruto (AUD-M2). */
const CAMPOS_PROTEGIDOS_VISTA = new Set([
  'nro_cuenta_sueldo',
  'cci_sueldo',
  'nro_cuenta_cts',
  'cci_cts',
  'cuspp',
]);

/** Diccionario de etiquetas legibles en español para los campos auditados (AUD-M2). */
export const ETIQUETAS_CAMPOS_AUDITORIA: Record<string, string> = {
  nombre: 'Nombre',
  apellido: 'Apellido',
  nro_documento: 'Número de documento',
  documento_id: 'Tipo de documento',
  email: 'Correo electrónico',
  telefono: 'Teléfono',
  sexo: 'Sexo',
  estado_civil: 'Estado civil',
  fecha_nacimiento: 'Fecha de nacimiento',
  direccion: 'Dirección',
  referencia_direccion: 'Referencia de dirección',
  distrito: 'Distrito',
  provincia: 'Provincia',
  departamento: 'Departamento',
  area_id: 'Área',
  id_area: 'Área',
  cargo_id: 'Cargo',
  jornada_id: 'Jornada laboral',
  fecha_inicio: 'Fecha de inicio',
  fecha_fin: 'Fecha de fin',
  fecha_cese: 'Fecha de cese',
  estado_laboral: 'Estado laboral',
  motivo_baja: 'Motivo de baja',
  asig_familiar: 'Asignación familiar',
  sueldo_basico: 'Sueldo básico',
  id_regimen: 'Régimen pensionario',
  id_tipo_afp: 'AFP',
  tipo_comision: 'Tipo de comisión AFP',
  afp_fecha_filiacion: 'Fecha de afiliación AFP',
  id_banco_sueldo: 'Banco de haberes',
  nro_cuenta_sueldo: 'Cuenta de sueldo',
  cci_sueldo: 'CCI de sueldo',
  id_banco_cts: 'Banco de CTS',
  nro_cuenta_cts: 'Cuenta de CTS',
  cci_cts: 'CCI de CTS',
  cuspp: 'CUSPP',
  regimen_salud: 'Régimen de salud',
  eps_costo_adicional: 'Costo adicional EPS',
  tipo_modalidad: 'Modalidad de contrato',
  estado: 'Estado',
  observacion: 'Observación',
  vinculo: 'Vínculo familiar',
  acreditado_essalud: 'Acreditado en EsSalud',
  activo: 'Activo',
  deleted_at: 'Baja lógica',
  rol: 'Rol del sistema',
};

export interface CambioCampoAuditoria {
  campo: string;
  etiqueta: string;
  antes: unknown;
  despues: unknown;
  protegido?: boolean;
}

/**
 * Normaliza un valor escalar o fecha ISO para evitar falsos positivos al comparar antes/después (AUD-M2).
 */
function normalizarValorAuditoria(valor: unknown): unknown {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(valor)) {
    return valor.slice(0, 10);
  }
  if (typeof valor === 'object') {
    return JSON.stringify(valor);
  }
  return valor;
}

/**
 * Calcula la lista de campos modificados entre `valores_antes` y `valores_despues` (AUD-M2).
 * - Oculta `password_hash` y `token_hash`.
 * - Marca cuentas bancarias, CCI y CUSPP con `protegido: true` y valores `null`.
 * - Traduce IDs de catálogos si se provee el diccionario `nombresCatalogos`.
 */
export function calcularCambiosAuditoria(antesRaw: unknown, despuesRaw: unknown, nombresCatalogos: Record<string, string> = {} ): CambioCampoAuditoria[] {
  const antes = antesRaw && typeof antesRaw === 'object' && !Array.isArray(antesRaw)
      ? (antesRaw as Record<string, unknown>)
      : {};
  const despues = despuesRaw && typeof despuesRaw === 'object' && !Array.isArray(despuesRaw)
      ? (despuesRaw as Record<string, unknown>)
      : {};

  const claves = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  const cambios: CambioCampoAuditoria[] = [];

  for (const campo of claves) {
    if (CAMPOS_TECNICOS_IGNORADOS.has(campo)) continue;
    if (campo === 'password' || campo === 'password_hash' || campo === 'token_hash') continue;

    const valAntes = normalizarValorAuditoria(antes[campo]);
    const valDespues = normalizarValorAuditoria(despues[campo]);

    if (valAntes === valDespues) continue;

    const etiqueta = ETIQUETAS_CAMPOS_AUDITORIA[campo] ?? campo;

    if (CAMPOS_PROTEGIDOS_VISTA.has(campo) || CAMPOS_SENSIBLES_AUDITORIA.has(campo)) {
      cambios.push({
        campo,
        etiqueta,
        antes: null,
        despues: null,
        protegido: true,
      });
      continue;
    }

    const traducir = (v: unknown) => typeof v === 'string' && nombresCatalogos[v] ? nombresCatalogos[v] : v;

    cambios.push({
      campo,
      etiqueta,
      antes: traducir(valAntes),
      despues: traducir(valDespues),
    });
  }

  return cambios;
}
