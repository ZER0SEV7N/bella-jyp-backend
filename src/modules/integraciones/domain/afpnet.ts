//src/modules/integraciones/domain/afpnet.ts
import type { ConfiguracionExportacionDto, FilaExportacionDto } from '@jyp/shared-contracts';
import Decimal from 'decimal.js';
import { importeDos, numeroFijo, textoFijo, tipoDocumento } from './campos-formato';

// Funciones de dominio que formatean las estructuras de texto plano de AFPnet garantizando longitudes fijas (141 caracteres) y validaciones de datos.
const montoAFPNET = (valor: string) => numeroFijo(importeDos(valor).replace('.', ''), 9);

/**
 * Función que genera una línea de texto plano para el archivo de exportación a AFPnet, formateando los campos según las especificaciones requeridas.
 * @param fila - Un objeto que contiene los datos de la fila a exportar, incluyendo información del trabajador y sus remuneraciones.
 * @param secuencia - Número de secuencia de la línea dentro del archivo de exportación.
 * @param config - Objeto que contiene la configuración de exportación, incluyendo los apellidos del trabajador y los aportes voluntarios.
 * @returns Una cadena que representa la línea formateada para el archivo de exportación a AFPnet.
 * @throws RangeError si el trabajador no está afiliado al SPP, si faltan datos requeridos en la configuración, si los importes son cero o si el CUSPP no cumple con el formato esperado.
 */
export function lineaAFPNET(fila: FilaExportacionDto, secuencia: number, config: ConfiguracionExportacionDto): string {
    // Valida que el trabajador esté afiliado al SPP (Sistema Privado de Pensiones) antes de generar la línea de exportación.
    if (fila.regimen !== 'AFP')
        throw new RangeError('AFPnet solo recibe trabajadores afiliados al SPP.');

    // Obtiene los apellidos del trabajador desde la configuración, asegurando que estén presentes y correctamente separados.
    const apellidos = config.apellidos_afpnet?.[fila.empleado_id];
    if (!apellidos)
        throw new RangeError('AFPnet requiere apellido paterno y materno separados y confirmados; no se divide el apellido por espacios.');

    // Obtiene los aportes voluntarios del trabajador desde la configuración, asegurando que estén presentes y correctamente definidos.
    const voluntarios = config.aportes_voluntarios?.[fila.empleado_id];
    if (!voluntarios)
        throw new RangeError('Confirme expresamente los tres aportes voluntarios, aunque sus importes sean cero.');

    // Valida que la remuneración base no sea cero, ya que AFPnet requiere declarar la excepción de aportar en caso de remuneración cero.
    const base = importeDos(fila.resultado.base_previsional);
    if (new Decimal(base).isZero())
        throw new RangeError('La remuneración cero requiere declarar la excepción de aportar; este alcance no infiere su motivo.');

    // Valida que el CUSPP del trabajador tenga exactamente 12 posiciones o esté vacío, lanzando un error si no es así.
    if (fila.cuspp && !/^[a-zA-Z0-9]{12}$/.test(fila.cuspp))
        throw new RangeError('El CUSPP debe tener doce posiciones o quedar vacío.');

    // Determina si el trabajador inició o cesó en el mes del periodo evaluado, marcando 'S' para sí y 'N' para no.
    const inicio = fila.fecha_inicio.slice(0, 7) === fila.periodo ? 'S' : 'N';
    const cese = fila.fecha_cese?.slice(0, 7) === fila.periodo ? 'S' : 'N';

    // Construye la línea de exportación concatenando los campos formateados y asegurando que la longitud total sea de 141 caracteres.
    const linea =
        numeroFijo(String(secuencia), 5) +
        textoFijo(fila.cuspp ?? '', 12) +
        tipoDocumento(fila.tipo_documento, 'AFPNET') +
        textoFijo(fila.cabecera.nro_documento, 20) +
        textoFijo(apellidos.paterno.toUpperCase(), 20) +
        textoFijo(apellidos.materno.toUpperCase(), 20) +
        textoFijo(fila.nombres.toUpperCase(), 20) +
        'S' +
        inicio +
        cese +
        ' ' +
        montoAFPNET(base) +
        montoAFPNET(voluntarios.con_fin) +
        montoAFPNET(voluntarios.sin_fin) +
        montoAFPNET(voluntarios.empleador) +
        'N' +
        '  ';

    // Valida que la línea generada tenga exactamente 141 posiciones, lanzando un error si no es así.
    if (linea.length !== 141)
        throw new RangeError('La línea AFPnet no tiene 141 posiciones.');
    return linea;
}

// Alias de compatibilidad con el ejecutor de tareas n8n (`n8n/tareas/exportar.cjs`).
export const lineaAfpnet = lineaAFPNET;
