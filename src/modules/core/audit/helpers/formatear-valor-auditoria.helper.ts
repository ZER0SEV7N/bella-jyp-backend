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

/** Patrón de un valor técnico en mayúsculas con guiones bajos (`AUSENCIA_SIN_GOCE`). */
const PATRON_CLAVE_TECNICA = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

/** Convierte un valor simple a texto, humanizando las claves técnicas. */
function aTextoSimple(valor: unknown): string {
  if (typeof valor === 'string') {
    return PATRON_CLAVE_TECNICA.test(valor) ? humanizarAuditoria(valor) : valor;
  }
  if (
    typeof valor === 'number' ||
    typeof valor === 'boolean' ||
    typeof valor === 'bigint'
  ) {
    return String(valor);
  }
  return '';
}

/** Convierte cualquier valor a texto sin caer en `[object Object]` ni en JSON. */
function aTexto(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (
    typeof valor === 'number' ||
    typeof valor === 'boolean' ||
    typeof valor === 'bigint'
  ) {
    return String(valor);
  }
  if (Array.isArray(valor) || esObjeto(valor)) {
    return describirValorCompuesto(valor);
  }
  return '';
}

/** Describe una lista sin JSON: valores simples unidos o la cantidad de registros. */
function describirLista(valor: unknown[]): string {
  const utiles = valor.filter((item) => !estaVacio(item));
  if (utiles.length === 0) return '';
  if (utiles.every((item) => aTextoSimple(item) !== '')) {
    return utiles.map((item) => aTextoSimple(item)).join(', ');
  }
  return utiles.length === 1 ? '1 registro' : `${utiles.length} registros`;
}

/** Describe un objeto sin JSON: cada valor simple como `Etiqueta: valor`; los anidados se omiten. */
function describirObjeto(valor: ElementoLista): string {
  const partes: string[] = [];
  for (const [campo, item] of Object.entries(valor)) {
    const texto = aTextoSimple(item);
    if (texto === '') continue;
    partes.push(`${humanizarAuditoria(campo)}: ${texto}`);
  }
  if (partes.length > 0) return partes.join(' · ');
  return Object.keys(valor).length > 0 ? 'Datos actualizados' : '';
}

/** Último recurso de un valor compuesto: nunca devuelve JSON. */
function describirValorCompuesto(valor: unknown): string {
  if (Array.isArray(valor)) return describirLista(valor);
  if (esObjeto(valor)) return describirObjeto(valor);
  return '';
}

function estaVacio(valor: unknown): boolean {
  return valor === undefined || valor === null || valor === '';
}

/** Separa de a tres cifras desde la derecha (`1234567` → `1,234,567`) sin expresiones regulares. */
function agruparMiles(entero: string): string {
  const grupos: string[] = [];
  for (let fin = entero.length; fin > 0; fin -= 3) {
    grupos.unshift(entero.slice(Math.max(0, fin - 3), fin));
  }
  return grupos.join(',');
}

function formatearMoneda(valor: unknown): string {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return aTexto(valor);
  const [entero, decimales] = Math.abs(numero).toFixed(2).split('.');
  const miles = agruparMiles(entero);
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
    case 'lista': {
      const texto = describirValorCompuesto(valor);
      return texto || null;
    }
    default: {
      const texto = aTexto(valor);
      return texto || null;
    }
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
 * Ordena un conjunto de claves según el orden de la configuración. Las claves que no están en la
 * configuración quedan después, en el orden en que llegaron. El orden es estable: un `jsonb` de
 * Postgres ordena sus claves por longitud y alfabéticamente, no como las define la vista.
 *
 * @param claves - Claves que se quieren ordenar.
 * @param ordenConfig - Claves de la configuración, en el orden en que deben mostrarse.
 * @returns Una lista nueva con las claves ordenadas.
 */
export function ordenarSegunConfig(
  claves: readonly string[],
  ordenConfig: readonly string[]
): string[] {
  const posicion = new Map<string, number>();
  ordenConfig.forEach((clave, indice) => posicion.set(clave, indice));
  const desconocida = ordenConfig.length;

  return claves
    .map((clave, indice) => ({ clave, indice }))
    .sort((a, b) => {
      const diferencia =
        (posicion.get(a.clave) ?? desconocida) -
        (posicion.get(b.clave) ?? desconocida);
      return diferencia !== 0 ? diferencia : a.indice - b.indice;
    })
    .map(({ clave }) => clave);
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
  const etiquetasConocidas = config.elemento?.etiquetas ?? {};
  const elementosAntes = indexarElementos(antes, clave);
  const elementosDespues = indexarElementos(despues, clave);
  const identificadores = ordenarSegunConfig(
    [...new Set([...elementosDespues.keys(), ...elementosAntes.keys()])],
    Object.keys(etiquetasConocidas)
  );

  const detalle: DetalleElementoAuditoria[] = [];
  for (const identificador of identificadores) {
    const previo = elementosAntes.get(identificador);
    const posterior = elementosDespues.get(identificador);
    const campos = ordenarSegunConfig(
      [
        ...new Set([
          ...Object.keys(posterior ?? {}),
          ...Object.keys(previo ?? {}),
        ]),
      ],
      Object.keys(camposConocidos)
    );

    const cambios: DetalleElementoAuditoria['cambios'] = [];
    for (const campo of campos) {
      if (campo === clave) continue;
      const configCampo = camposConocidos[campo];
      if (configCampo?.oculto) continue;
      const valorAntes = previo?.[campo];
      const valorDespues = posterior?.[campo];
      const configFormato =
        configCampo ??
        inferirConfigCampoAuditoria(campo, valorDespues ?? valorAntes);
      const textoAntes = formatearValorAuditoria(
        configFormato,
        valorAntes,
        nombres
      );
      const textoDespues = formatearValorAuditoria(
        configFormato,
        valorDespues,
        nombres
      );
      if (textoAntes === textoDespues) continue;
      cambios.push({
        campo,
        etiqueta: configFormato.etiqueta,
        tipo: configFormato.tipo,
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

/** Día de la semana abreviado en español, según `Date.getUTCDay()` (0 = domingo). */
const DIAS_SEMANA_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const PATRON_CLAVE_FECHA = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Convierte una clave ISO (`2026-11-01`) en `01/11 dom`. Usa UTC para que la fecha no se corra por
 * la zona horaria.
 */
function formatearClaveFecha(identificador: string): string | null {
  const coincidencia = PATRON_CLAVE_FECHA.exec(identificador);
  if (!coincidencia) return null;
  const [, anio, mes, dia] = coincidencia;
  const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
  if (Number.isNaN(fecha.getTime())) return null;
  return `${dia}/${mes} ${DIAS_SEMANA_CORTOS[fecha.getUTCDay()]}`;
}

function describirElemento(
  config: CampoAuditoriaConfig,
  identificador: string
): string {
  if (identificador === '') return config.etiqueta;
  const etiqueta = config.elemento?.etiquetas?.[identificador];
  if (etiqueta) return etiqueta;
  if (config.elemento?.formatoClave === 'fecha') {
    const fecha = formatearClaveFecha(identificador);
    if (fecha) return fecha;
  }
  if (identificador.startsWith('#'))
    return `Elemento ${identificador.slice(1)}`;
  return humanizarAuditoria(identificador);
}
