//src/modules/core/audit/helpers/formatear-valor-auditoria.helper.ts
import type {
  CampoAuditoriaConfig,
  EntidadReferenciaAuditoria,
  TipoCampoAuditoria,
} from '../config/auditoria-tablas.config';
import type {
  DetalleElementoAuditoria,
  ValorCambioAuditoria,
} from '@jyp/shared-contracts';

/** Nombre legible de un registro referenciado y un dato corto que ayuda a reconocerlo. */
export interface NombreResueltoAuditoria {
  nombre: string;
  detalle: string | null;
}

/** Nombres ya resueltos, por entidad y por ID. */
export type NombresResueltosAuditoria = Record<
  EntidadReferenciaAuditoria,
  Map<string, NombreResueltoAuditoria>
>;

/** Lima no tiene horario de verano: el desfase respecto a UTC es fijo. */
const DESFASE_LIMA_MS = 5 * 60 * 60 * 1000;
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}/;
const PATRON_FECHA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Crea el contenedor vacío de nombres resueltos.
 *
 * @returns Un mapa vacío por cada entidad referenciable.
 */
export function crearNombresResueltosVacios(): NombresResueltosAuditoria {
  return {
    empleado: new Map(),
    area: new Map(),
    cargo: new Map(),
    jornada: new Map(),
    banco: new Map(),
    afp: new Map(),
    regimen: new Map(),
    tipo_documento: new Map(),
    derechohabiente: new Map(),
    usuario: new Map(),
  };
}

/**
 * Convierte un nombre técnico en texto legible: `HIJO_MENOR` → `Hijo menor`.
 *
 * @param valor - Nombre técnico o valor de enum.
 * @returns El texto con espacios y la primera letra en mayúscula.
 */
export function humanizarAuditoria(valor: string): string {
  const texto = valor.replace(/_/g, ' ').trim().toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Convierte cualquier valor a texto sin caer en `[object Object]`. */
function aTexto(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'object' && valor !== null) return JSON.stringify(valor);
  if (
    typeof valor === 'number' ||
    typeof valor === 'boolean' ||
    typeof valor === 'bigint'
  ) {
    return String(valor);
  }
  return '';
}

function estaVacio(valor: unknown): boolean {
  return valor === undefined || valor === null || valor === '';
}

function formatearMoneda(valor: unknown): string {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return aTexto(valor);
  const [entero, decimales] = Math.abs(numero).toFixed(2).split('.');
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${numero < 0 ? '-' : ''}S/ ${miles}.${decimales}`;
}

function formatearFechaHora(valor: unknown): string {
  if (typeof valor !== 'string' || !PATRON_FECHA_HORA.test(valor)) {
    return aTexto(valor);
  }
  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime())) return valor;
  return new Date(instante.getTime() - DESFASE_LIMA_MS)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ');
}

function esBooleanoVerdadero(valor: unknown): boolean {
  return valor === true || valor === 'true' || valor === 1;
}

/**
 * Deduce cómo mostrar un campo que no está en la configuración: así agregar columnas a la base de
 * datos no rompe la vista.
 *
 * @param campo - Nombre técnico del campo.
 * @param valor - Valor de ejemplo para deducir el tipo.
 * @returns Una configuración mínima con la etiqueta humanizada.
 */
export function inferirConfigCampoAuditoria(
  campo: string,
  valor: unknown
): CampoAuditoriaConfig {
  let tipo: TipoCampoAuditoria = 'texto';
  if (typeof valor === 'boolean') tipo = 'booleano';
  else if (typeof valor === 'number') tipo = 'numero';
  else if (typeof valor === 'object' && valor !== null) tipo = 'lista';
  else if (typeof valor === 'string' && PATRON_FECHA_HORA.test(valor)) {
    tipo = valor.endsWith('T00:00:00.000Z') ? 'fecha' : 'fecha_hora';
  }
  return { etiqueta: humanizarAuditoria(campo), tipo };
}

/**
 * Convierte un valor guardado en la auditoría a lenguaje de negocio: IDs a nombres, enums a su
 * etiqueta, fechas normalizadas, importes con símbolo y booleanos como Sí/No.
 *
 * @param config - Descripción del campo; si falta, se deduce del valor.
 * @param valor - Valor crudo de `valores_antes` o `valores_despues`.
 * @param nombres - Nombres de referencias ya resueltos en lote.
 * @returns El valor legible, o `null` si no hay valor.
 */
export function formatearValorAuditoria(
  config: CampoAuditoriaConfig | undefined,
  valor: unknown,
  nombres: NombresResueltosAuditoria
): ValorCambioAuditoria {
  if (estaVacio(valor)) return null;
  const tipo = config?.tipo ?? inferirConfigCampoAuditoria('', valor).tipo;

  switch (tipo) {
    case 'referencia': {
      const id = aTexto(valor);
      const entidad = config?.entidad;
      return (entidad && nombres[entidad].get(id)?.nombre) || id;
    }
    case 'enum': {
      const clave = aTexto(valor);
      return config?.opciones?.[clave] ?? humanizarAuditoria(clave);
    }
    case 'booleano':
      return esBooleanoVerdadero(valor) ? 'Sí' : 'No';
    case 'moneda':
      return formatearMoneda(valor);
    case 'numero': {
      const numero = Number(valor);
      return Number.isFinite(numero) ? numero : aTexto(valor);
    }
    case 'fecha':
      return typeof valor === 'string' && PATRON_FECHA.test(valor)
        ? valor.slice(0, 10)
        : aTexto(valor);
    case 'fecha_hora':
      return formatearFechaHora(valor);
    case 'hora':
      return aTexto(valor).slice(0, 5);
    case 'lista':
      return JSON.stringify(valor);
    default:
      return typeof valor === 'object' ? JSON.stringify(valor) : aTexto(valor);
  }
}

type ElementoLista = Record<string, unknown>;

function esObjeto(valor: unknown): valor is ElementoLista {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Indexa una lista por la clave que identifica a cada elemento. Un objeto suelto se trata como
 * un único elemento y un elemento que no es objeto se envuelve en `{ valor }`.
 */
function indexarElementos(
  valor: unknown,
  clave: string | undefined
): Map<string, ElementoLista> {
  const elementos = new Map<string, ElementoLista>();
  if (Array.isArray(valor)) {
    (valor as unknown[]).forEach((item, posicion) => {
      const elemento = esObjeto(item) ? item : { valor: item };
      const identificador = clave ? elemento[clave] : undefined;
      elementos.set(
        typeof identificador === 'string' ? identificador : `#${posicion + 1}`,
        elemento
      );
    });
  } else if (esObjeto(valor)) {
    elementos.set('', valor);
  }
  return elementos;
}

/**
 * Compara dos listas (o JSON anidados) elemento por elemento y devuelve solo los elementos que
 * cambiaron. En una creación no hay valor anterior, así que devuelve todos los elementos que
 * tengan algún valor.
 *
 * @param config - Descripción del campo de tipo `lista`.
 * @param antes - Lista previa.
 * @param despues - Lista posterior.
 * @param nombres - Nombres de referencias ya resueltos en lote.
 * @returns Los elementos modificados, cada uno con sus campos cambiados.
 */
export function compararListaAuditoria(
  config: CampoAuditoriaConfig,
  antes: unknown,
  despues: unknown,
  nombres: NombresResueltosAuditoria
): DetalleElementoAuditoria[] {
  const clave = config.elemento?.clave;
  const camposConocidos = config.elemento?.campos ?? {};
  const elementosAntes = indexarElementos(antes, clave);
  const elementosDespues = indexarElementos(despues, clave);
  const identificadores = [
    ...new Set([...elementosDespues.keys(), ...elementosAntes.keys()]),
  ];

  const detalle: DetalleElementoAuditoria[] = [];
  for (const identificador of identificadores) {
    const previo = elementosAntes.get(identificador);
    const posterior = elementosDespues.get(identificador);
    const campos = new Set([
      ...Object.keys(posterior ?? {}),
      ...Object.keys(previo ?? {}),
    ]);

    const cambios: DetalleElementoAuditoria['cambios'] = [];
    for (const campo of campos) {
      if (campo === clave) continue;
      const valorAntes = previo?.[campo];
      const valorDespues = posterior?.[campo];
      const configCampo =
        camposConocidos[campo] ??
        inferirConfigCampoAuditoria(campo, valorDespues ?? valorAntes);
      const textoAntes = formatearValorAuditoria(
        configCampo,
        valorAntes,
        nombres
      );
      const textoDespues = formatearValorAuditoria(
        configCampo,
        valorDespues,
        nombres
      );
      if (textoAntes === textoDespues) continue;
      cambios.push({
        campo,
        etiqueta: configCampo.etiqueta,
        tipo: configCampo.tipo,
        antes: textoAntes,
        despues: textoDespues,
      });
    }

    if (cambios.length === 0) continue;
    detalle.push({
      elemento: identificador,
      etiqueta: describirElemento(config, identificador),
      cambios,
    });
  }
  return detalle;
}

function describirElemento(
  config: CampoAuditoriaConfig,
  identificador: string
): string {
  if (identificador === '') return config.etiqueta;
  const etiqueta = config.elemento?.etiquetas?.[identificador];
  if (etiqueta) return etiqueta;
  if (identificador.startsWith('#'))
    return `Elemento ${identificador.slice(1)}`;
  return humanizarAuditoria(identificador);
}
