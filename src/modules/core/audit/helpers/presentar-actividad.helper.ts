//src/modules/core/audit/helpers/presentar-actividad.helper.ts
import {
  ETIQUETAS_ACCION_AUDITORIA,
  RESUMEN_GENERICO_AUDITORIA,
  TABLAS_AUDITORIA,
  obtenerConfigCampoAuditoria,
  type AccionVistaAuditoria,
  type EntidadReferenciaAuditoria,
  type TipoAfectadoAuditoria,
} from '../config/auditoria-tablas.config';
import type {
  CambioActividadAuditoria,
  DetalleActividadAuditoria,
  FilaActividadAuditoria,
} from '../contracts/actividad-auditoria.schema';
import { calcularCambiosAuditoria } from './calcular-cambios-auditoria.helper';
import {
  compararListaAuditoria,
  formatearValorAuditoria,
  humanizarAuditoria,
  inferirConfigCampoAuditoria,
  type NombresResueltosAuditoria,
} from './formatear-valor-auditoria.helper';
import {
  extraerAfectadoAuditoria,
  type AfectadoAuditoria,
} from './resolver-afectado-auditoria.helper';
import {
  crearIdsPorEntidadVacios,
  resolverNombresAuditoria,
  type ClienteNombresAuditoria,
  type IdsPorEntidadAuditoria,
} from './resolver-nombres-auditoria.helper';

/** Fila de `audit_log` con el usuario que hizo el cambio, tal como la leen los casos de uso. */
export interface FilaAuditoriaActividad {
  id: string;
  created_at: Date;
  accion: string;
  tabla_afectada: string;
  registro_id: string;
  valores_antes: unknown;
  valores_despues: unknown;
  afectado_tipo: string | null;
  afectado_id: string | null;
  usuarios: {
    id: string;
    rol: string;
    email: string;
    empleados: { nombre: string; apellido: string } | null;
  } | null;
}

/** Selección del usuario (actor) que deben incluir las consultas de actividad. */
export const INCLUIR_ACTOR_AUDITORIA = {
  usuarios: {
    select: {
      id: true,
      rol: true,
      email: true,
      empleados: { select: { nombre: true, apellido: true } },
    },
  },
} as const;

type Valores = Record<string, unknown>;

/** Entidad a consultar para obtener el nombre de cada tipo de afectado. */
const ENTIDAD_POR_AFECTADO: Partial<
  Record<TipoAfectadoAuditoria, EntidadReferenciaAuditoria>
> = {
  empleado: 'empleado',
  area: 'area',
  cargo: 'cargo',
  jornada: 'jornada',
};

const ACCION_MASIVA: Record<string, AccionVistaAuditoria> = {
  CREATEMANY: 'CREACION',
  UPDATEMANY: 'EDICION',
  DELETEMANY: 'ELIMINACION',
};

const VERBO_MASIVO: Record<AccionVistaAuditoria, string> = {
  CREACION: 'Creó',
  EDICION: 'Editó',
  BAJA: 'Dio de baja',
  REACTIVACION: 'Reactivó',
  ELIMINACION: 'Eliminó',
};

function comoValores(valor: unknown): Valores | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Valores)
    : null;
}

function estaDadoDeBaja(valores: Valores | null): boolean {
  return Boolean(valores && (valores.deleted_at || valores.activo === false));
}

function textoONada(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

function esUpsertNuevo(despues: Valores | null): boolean {
  const creado = Date.parse(textoONada(despues?.created_at));
  const actualizado = Date.parse(textoONada(despues?.updated_at));
  return (
    Number.isFinite(creado) &&
    Number.isFinite(actualizado) &&
    Math.abs(actualizado - creado) < 2000
  );
}

/**
 * Traduce la acción técnica a la acción de negocio que ve RRHH. Un `UPDATE` que llena `deleted_at`
 * o pasa `activo` a `false` es una baja, y el inverso es una reactivación. Un `UPSERT` no guarda el
 * estado previo, así que se considera creación si la fila tiene `created_at` igual a `updated_at`.
 *
 * @param fila - Fila de auditoría.
 * @returns La acción de negocio.
 */
export function clasificarAccionAuditoria(
  fila: Pick<
    FilaAuditoriaActividad,
    'accion' | 'valores_antes' | 'valores_despues'
  >
): AccionVistaAuditoria {
  const accion = fila.accion.toUpperCase();
  if (accion === 'CREATE') return 'CREACION';
  if (accion === 'DELETE') return 'ELIMINACION';
  if (ACCION_MASIVA[accion]) return ACCION_MASIVA[accion];

  const antes = comoValores(fila.valores_antes);
  const despues = comoValores(fila.valores_despues);
  if (accion === 'UPSERT')
    return esUpsertNuevo(despues) ? 'CREACION' : 'EDICION';
  if (accion !== 'UPDATE' || !antes || !despues) return 'EDICION';

  const antesDeBaja = estaDadoDeBaja(antes);
  const despuesDeBaja = estaDadoDeBaja(despues);
  if (!antesDeBaja && despuesDeBaja) return 'BAJA';
  if (antesDeBaja && !despuesDeBaja) return 'REACTIVACION';
  return 'EDICION';
}

/**
 * Obtiene el afectado de una fila: usa las columnas `afectado_tipo` y `afectado_id` y, si están
 * vacías (registros anteriores al relleno), lo deduce de los valores guardados.
 *
 * @param fila - Fila de auditoría.
 * @returns El afectado, o `null` si no se puede determinar.
 */
export function obtenerAfectadoFila(
  fila: FilaAuditoriaActividad
): AfectadoAuditoria | null {
  if (fila.afectado_tipo) {
    return {
      tipo: fila.afectado_tipo as TipoAfectadoAuditoria,
      id: fila.afectado_id,
    };
  }
  const deducido = extraerAfectadoAuditoria(
    fila.tabla_afectada,
    fila.registro_id,
    fila.valores_antes,
    fila.valores_despues
  );
  //Sin el relleno no se conoce el empleado de un documento de derechohabiente: es mejor no
  //mostrar afectado que mostrar uno incompleto.
  if (!deducido || deducido.derechohabienteId) return null;
  return { tipo: deducido.tipo, id: deducido.id };
}

function recolectarIds(
  filas: FilaAuditoriaActividad[],
  afectados: (AfectadoAuditoria | null)[]
): IdsPorEntidadAuditoria {
  const ids = crearIdsPorEntidadVacios();
  filas.forEach((fila, posicion) => {
    const afectado = afectados[posicion];
    const entidadAfectado = afectado && ENTIDAD_POR_AFECTADO[afectado.tipo];
    if (entidadAfectado && afectado.id) ids[entidadAfectado].add(afectado.id);

    const campos = TABLAS_AUDITORIA[fila.tabla_afectada]?.campos ?? {};
    for (const [campo, config] of Object.entries(campos)) {
      if (config.tipo !== 'referencia' || !config.entidad) continue;
      for (const origen of [fila.valores_antes, fila.valores_despues]) {
        const valor = comoValores(origen)?.[campo];
        if (typeof valor === 'string' && valor) ids[config.entidad].add(valor);
      }
    }
  });
  return ids;
}

function aplanarNombres(
  nombres: NombresResueltosAuditoria
): Record<string, string> {
  const planos: Record<string, string> = {};
  for (const entidad of Object.values(nombres)) {
    for (const [id, resuelto] of entidad) planos[id] = resuelto.nombre;
  }
  return planos;
}

function construirCambios(
  fila: FilaAuditoriaActividad,
  accion: AccionVistaAuditoria,
  nombres: NombresResueltosAuditoria
): CambioActividadAuditoria[] {
  if (ACCION_MASIVA[fila.accion.toUpperCase()]) return [];

  const tabla = fila.tabla_afectada;
  const antes = comoValores(fila.valores_antes);
  const despues = comoValores(fila.valores_despues);
  const afectadoConfig = TABLAS_AUDITORIA[tabla]?.afectado;
  //Solo el campo que ES el afectado se omite; el derechohabiente de un documento no lo es.
  const campoContexto =
    afectadoConfig?.origen === 'campo' ? afectadoConfig.campo : undefined;
  const base = calcularCambiosAuditoria(
    antes,
    despues,
    aplanarNombres(nombres),
    tabla
  );

  const cambios: CambioActividadAuditoria[] = [];
  for (const cambio of base) {
    const config = obtenerConfigCampoAuditoria(tabla, cambio.campo);
    if (config?.oculto) continue;
    if (
      (accion === 'BAJA' || accion === 'REACTIVACION') &&
      (cambio.campo === 'deleted_at' || cambio.campo === 'activo')
    ) {
      continue;
    }
    if (accion === 'CREACION' && cambio.campo === campoContexto) continue;

    if (cambio.protegido) {
      cambios.push({
        campo: cambio.campo,
        etiqueta: cambio.etiqueta,
        tipo: config?.tipo ?? 'texto',
        antes: null,
        despues: null,
        protegido: true,
      });
      continue;
    }

    const valorAntes = antes?.[cambio.campo];
    const valorDespues = despues?.[cambio.campo];
    const campo =
      config ??
      inferirConfigCampoAuditoria(cambio.campo, valorDespues ?? valorAntes);

    if (campo.tipo === 'lista') {
      const detalle = compararListaAuditoria(
        campo,
        valorAntes,
        valorDespues,
        nombres
      );
      if (detalle.length === 0) continue;
      cambios.push({
        campo: cambio.campo,
        etiqueta: cambio.etiqueta,
        tipo: 'lista',
        antes: null,
        despues: null,
        detalle,
      });
      continue;
    }

    const textoAntes = formatearValorAuditoria(campo, valorAntes, nombres);
    const textoDespues = formatearValorAuditoria(campo, valorDespues, nombres);
    if (textoAntes === textoDespues) continue;
    cambios.push({
      campo: cambio.campo,
      etiqueta: cambio.etiqueta,
      tipo: campo.tipo,
      antes: textoAntes,
      despues: textoDespues,
    });
  }
  return cambios;
}

function rellenarPlantilla(
  plantilla: string,
  valores: Record<string, string>
): string {
  return plantilla
    .replace(/\{([\w.]+)\}/g, (_, nombre: string) => valores[nombre] ?? '')
    .replace(/\s*\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.:])/g, '$1')
    .trim();
}

function construirResumen(
  fila: FilaAuditoriaActividad,
  accion: AccionVistaAuditoria,
  contexto: {
    afectado: FilaActividadAuditoria['afectado'];
    moduloEtiqueta: string;
    campos: string[];
    nombres: NombresResueltosAuditoria;
  }
): string {
  const { afectado, moduloEtiqueta, campos, nombres } = contexto;
  const despues = comoValores(fila.valores_despues);

  if (ACCION_MASIVA[fila.accion.toUpperCase()]) {
    const cantidad = despues?.registros_afectados;
    const registros =
      typeof cantidad === 'number'
        ? `${cantidad} registro(s)`
        : 'varios registros';
    const sufijo = afectado ? ` (${afectado.nombre})` : '';
    return `${VERBO_MASIVO[accion]} ${registros} de ${moduloEtiqueta}${sufijo}`;
  }

  const tabla = TABLAS_AUDITORIA[fila.tabla_afectada];
  let plantilla = tabla?.resumen[accion] ?? RESUMEN_GENERICO_AUDITORIA[accion];
  if (campos.length === 0) plantilla = plantilla.replace(/:?\s*\{campos\}/, '');

  const valores: Record<string, string> = {
    afectado: afectado?.nombre ?? 'un registro',
    campos: campos.join(', '),
    modulo: moduloEtiqueta,
  };
  const fuente = despues ?? comoValores(fila.valores_antes);
  for (const [campo, valor] of Object.entries(fuente ?? {})) {
    if (campo in valores) continue;
    const texto = formatearValorAuditoria(
      obtenerConfigCampoAuditoria(fila.tabla_afectada, campo),
      valor,
      nombres
    );
    valores[campo] = texto === null ? '' : String(texto);
    const config = obtenerConfigCampoAuditoria(fila.tabla_afectada, campo);
    if (
      config?.tipo === 'referencia' &&
      config.entidad &&
      typeof valor === 'string'
    ) {
      valores[`${campo}.detalle`] =
        nombres[config.entidad].get(valor)?.detalle ?? '';
    }
  }
  return rellenarPlantilla(plantilla, valores);
}

function presentarAfectado(
  afectado: AfectadoAuditoria | null,
  nombres: NombresResueltosAuditoria
): FilaActividadAuditoria['afectado'] {
  if (!afectado) return null;
  if (afectado.tipo === 'empresa') {
    return { tipo: 'empresa', id: null, nombre: 'Empresa', detalle: null };
  }
  const entidad = ENTIDAD_POR_AFECTADO[afectado.tipo];
  const resuelto =
    entidad && afectado.id ? nombres[entidad].get(afectado.id) : undefined;
  return {
    tipo: afectado.tipo,
    id: afectado.id,
    nombre:
      resuelto?.nombre ?? `${humanizarAuditoria(afectado.tipo)} no disponible`,
    detalle: resuelto?.detalle ?? null,
  };
}

function presentarActor(
  fila: FilaAuditoriaActividad
): FilaActividadAuditoria['actor'] {
  if (!fila.usuarios) return null;
  const { id, rol, email, empleados } = fila.usuarios;
  const nombre = empleados
    ? `${empleados.nombre} ${empleados.apellido}`.trim()
    : '';
  return { id, nombre: nombre || email, rol };
}

function presentarFilaCompleta(
  fila: FilaAuditoriaActividad,
  afectado: AfectadoAuditoria | null,
  nombres: NombresResueltosAuditoria
): { fila: FilaActividadAuditoria; cambios: CambioActividadAuditoria[] } {
  const accion = clasificarAccionAuditoria(fila);
  const cambios = construirCambios(fila, accion, nombres);
  const camposModificados = cambios.map((cambio) => cambio.etiqueta);
  const moduloEtiqueta =
    TABLAS_AUDITORIA[fila.tabla_afectada]?.moduloEtiqueta ??
    humanizarAuditoria(fila.tabla_afectada);
  const afectadoPresentado = presentarAfectado(afectado, nombres);

  const filaPresentada: FilaActividadAuditoria = {
    id: fila.id,
    fecha: fila.created_at.toISOString(),
    accion: fila.accion,
    accion_etiqueta: ETIQUETAS_ACCION_AUDITORIA[accion],
    modulo: fila.tabla_afectada,
    modulo_etiqueta: moduloEtiqueta,
    registro_id: fila.registro_id,
    actor: presentarActor(fila),
    afectado: afectadoPresentado,
    resumen: construirResumen(fila, accion, {
      afectado: afectadoPresentado,
      moduloEtiqueta,
      campos: camposModificados,
      nombres,
    }),
    campos_modificados: camposModificados,
  };
  return { fila: filaPresentada, cambios };
}

async function presentarFilas(
  prisma: ClienteNombresAuditoria,
  filas: FilaAuditoriaActividad[]
): Promise<
  { fila: FilaActividadAuditoria; cambios: CambioActividadAuditoria[] }[]
> {
  const afectados = filas.map(obtenerAfectadoFila);
  const nombres = await resolverNombresAuditoria(
    prisma,
    recolectarIds(filas, afectados)
  );
  return filas.map((fila, posicion) =>
    presentarFilaCompleta(fila, afectados[posicion], nombres)
  );
}

/**
 * Presenta una página de auditoría para RRHH: resuelve en lote los nombres de todas las
 * referencias (una consulta por entidad, nunca una por fila) y arma el resumen y los campos
 * modificados de cada fila.
 *
 * @param prisma - Cliente con los modelos de catálogo.
 * @param filas - Filas de `audit_log` de la página, con su actor.
 * @returns Las filas de actividad en el mismo orden.
 */
export async function presentarActividad(
  prisma: ClienteNombresAuditoria,
  filas: FilaAuditoriaActividad[]
): Promise<FilaActividadAuditoria[]> {
  const presentadas = await presentarFilas(prisma, filas);
  return presentadas.map(({ fila }) => fila);
}

/**
 * Presenta una fila de auditoría con su lista de cambios: IDs reemplazados por nombres, enums con
 * etiqueta, fechas normalizadas y listas comparadas por elemento.
 *
 * @param prisma - Cliente con los modelos de catálogo.
 * @param fila - Fila de `audit_log` con su actor.
 * @returns La fila de actividad más `cambios`.
 */
export async function presentarDetalleActividad(
  prisma: ClienteNombresAuditoria,
  fila: FilaAuditoriaActividad
): Promise<DetalleActividadAuditoria> {
  const [presentada] = await presentarFilas(prisma, [fila]);
  return { ...presentada.fila, cambios: presentada.cambios };
}
