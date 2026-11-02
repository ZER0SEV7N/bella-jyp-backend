//n8n/tareas/exportar.cjs
const Decimal = require('decimal.js');
const { createReadStream } = require('node:fs');
const { unlink } = require('node:fs/promises');
const { pipeline } = require('node:stream/promises');
const { join } = require('node:path');
const { escritor, metadatos } = require('./almacenamiento.cjs');
const { cabeceraBcp, detalleBcp } = require('../../dist/modules/integraciones/domain/bcp-haberes');
const { lineaAfpnet } = require('../../dist/modules/integraciones/domain/afpnet');
const { lineaJornadaPlame, lineasRemuneracionPlame, nombrePlame } = require('../../dist/modules/integraciones/domain/plame');
/**
 * Tarea de exportación de formatos homologados para la integración con sistemas bancarios y de seguridad social.
 * Esta tarea procesa un conjunto de filas de trabajo y genera archivos de salida en formatos específicos según el tipo de exportación solicitado.
 * Los formatos soportados incluyen BCP_HABERES, AFPNET, PLAME y COSTOS.
 * Cada formato tiene su propia lógica de generación de archivos y validaciones específicas.
 * Sus funciones principales son:
 * - exportar: Función principal que determina el tipo de exportación y delega a la función correspondiente.
 * - bcp: Genera un archivo de texto para pagos de haberes en formato BCP, incluyendo una cabecera calculada y un detalle de pagos.
 * - afpnet: Genera un archivo de texto para afiliados al SPP en formato AFPnet, con validaciones de empleador y secuencia de registros.
 * - plame: Genera archivos PLAME para jornadas y remuneraciones, asegurando que no se mezclen empresas en la exportación.
 * - costos: Genera un archivo CSV con los costos por área, incluyendo ingresos, descuentos, neto, reducciones por tiempo y aportes del empleador.
 *
 * Cada función maneja errores específicos y asegura que los archivos generados cumplan con los requisitos del formato solicitado.
 */

/**
 * Exporta un único formato confirmado. Los canales bancarios sin diseño homologado se rechazan.
 * @param {*} trabajo - El objeto de trabajo que contiene la información de la tarea.
 * @param {*} filas - Un generador asíncrono que devuelve filas de trabajo.
 * @param {*} directorio - El directorio donde se guardarán los archivos generados.
 * @returns - {Promise<*>} - Un arreglo de objetos que contienen los metadatos de los archivos generados.
 * @throws {Error} - Si ocurre un error durante la exportación del formato.
 */
async function exportar(trabajo, filas, directorio) {
    // Los formatos homologados se procesan según su tipo; los no homologados se rechazan.
    if (trabajo.tipo === 'BCP_HABERES') return bcp(trabajo, filas, directorio);
    if (trabajo.tipo === 'AFPNET') return afpnet(trabajo, filas, directorio);
    if (trabajo.tipo === 'PLAME') return plame(trabajo, filas, directorio);
    if (trabajo.tipo === 'COSTOS') return costos(trabajo, filas, directorio);
    throw new Error('El formato solicitado no tiene un generador homologado.');
}

/**
 * Exporta un formato BCP de haberes, generando un archivo de texto con los detalles de los pagos y una cabecera calculada.
 * @param {*} trabajo - El objeto de trabajo que contiene la información de la tarea.
 * @param {*} filas - Un generador asíncrono que devuelve filas de trabajo.
 * @param {*} directorio - El directorio donde se guardarán los archivos generados.
 * @returns - {Promise<*>} - Un arreglo de objetos que contienen los metadatos del archivo BCP generado.
 */
async function bcp(trabajo, filas, directorio) {
    // Se obtiene la configuración de la solicitud de trabajo para el formato BCP.
    const config = trabajo.solicitud.configuracion;

    // Se crea un archivo temporal para almacenar el detalle de los pagos antes de generar la cabecera.
    const detalle = escritor(directorio, 'abonos.tmp');

    // Se inicializan variables para calcular los totales y controlar la secuencia de pagos.
    let total = new Decimal(0), control = 0n, cantidad = 0, ruc;

    // Se procesan las filas de trabajo para generar el detalle de pagos y calcular los totales.
    try {
        // Se itera sobre cada fila de trabajo para generar el detalle de pagos.
        for await (const fila of filas) {
            ruc ??= fila.empresa.ruc;

            // Se valida que todas las filas pertenezcan al mismo empleador (RUC).
            if (fila.empresa.ruc !== ruc)
                throw new Error('El archivo BCP no puede mezclar empleadores.');
            
            // Se obtiene el detalle de pago para la fila actual y se actualizan los totales y el control.
            const pago = detalleBcp(fila, config);

            // Se actualizan los totales y el control con la información del pago actual.
            total = total.plus(pago.importe);
            control += pago.control;
            cantidad++;

            // Se escribe la línea de detalle en el archivo temporal.
            await detalle.linea(pago.linea);
        }

        // Se cierra el detalle antes de generar la cabecera, para poder calcular los totales.
        await detalle.cerrar();
        
        // Se genera el archivo principal con la cabecera calculada y se copia el detalle por stream.
        const nombre = `BCP-HABERES-${trabajo.periodo}.txt`;
        const archivo = escritor(directorio, nombre);
        await archivo.linea( cabeceraBcp(config, cantidad, total.toFixed(2), control));
        // El detalle se copia por stream después de la cabecera calculada, sin un buffer masivo.
        await pipeline(
            createReadStream(join(directorio, 'abonos.tmp')),
            archivo.stream,
            { end: false }
        );

        // Se cierra el archivo principal después de copiar el detalle.
        await archivo.cerrar();
        await unlink(join(directorio, 'abonos.tmp'));

        // Se devuelve la metadata del archivo generado.
        return [await metadatos(directorio, nombre, 'text/plain')];
    } catch (error) {
        detalle.cancelar();
        throw error;
    }
}

/**
 * Exporta los datos de AFPNET.
 * @param {*} trabajo - El objeto de trabajo que contiene la información de la tarea.
 * @param {*} filas - Un generador asíncrono que devuelve filas de trabajo.
 * @param {*} directorio - El directorio donde se guardarán los archivos generados.
 * @returns - {Promise<*>} - Un arreglo de objetos que contienen los metadatos del archivo AFPNET generado.
 * @throws {Error} - Si ocurre un error durante la exportación del formato AFPNET.
 */
async function afpnet(trabajo, filas, directorio) {
    // Se genera un nombre de archivo basado en el período del trabajo.
    const nombre = `AFPNET-${trabajo.periodo}.txt`;
    const archivo = escritor(directorio, nombre);
    let secuencia = 0, ruc;

    // Se procesan las filas de trabajo para generar las líneas del archivo AFPNET.
    try {
        // Se itera sobre cada fila de trabajo para generar las líneas del archivo AFPNET.
        for await (const fila of filas) {

            // Se valida que todas las filas pertenezcan al mismo empleador (RUC).
            ruc ??= fila.empresa.ruc;
            if (fila.empresa.ruc !== ruc)
                throw new Error('El archivo AFPnet no puede mezclar empleadores.');
            
            // Solo se procesan las filas que pertenecen al régimen AFP.
            if (fila.regimen === 'AFP')
                await archivo.linea(lineaAfpnet(fila, ++secuencia, trabajo.solicitud.configuracion));
        }

        // Se valida que al menos una fila haya sido procesada para generar el archivo AFPNET.
        if (!secuencia)
            throw new Error('No existen afiliados al SPP dentro de la selección.');
        
        // Se cierra el archivo AFPNET después de procesar todas las filas.
        await archivo.cerrar();
        return [await metadatos(directorio, nombre, 'text/plain')];
    } catch (error) {
        archivo.cancelar();
        throw error;
    }
}

/**
 * Exporta los datos de PLAME, generando archivos para jornadas y remuneraciones.
 * @param {*} trabajo - El objeto de trabajo que contiene la información de la tarea.
 * @param {*} filas - Un generador asíncrono que devuelve filas de trabajo.
 * @param {*} directorio - El directorio donde se guardarán los archivos generados.
 * @returns - {Promise<*>} - Un arreglo de objetos que contienen los metadatos de los archivos PLAME generados.
 * @throws {Error} - Si ocurre un error durante la exportación del formato PLAME.
 */
async function plame(trabajo, filas, directorio) {
    // Se inicializan variables para los archivos de jornada y remuneración, así como para el nombre de los archivos y el RUC del empleador.
    let jor, rem, nombreJor, nombreRem, ruc;
    
    // Se procesan las filas de trabajo para generar los archivos PLAME de jornada y remuneración.
    try {
        // Se itera sobre cada fila de trabajo para generar las líneas de los archivos PLAME.
        for await (const fila of filas) {
            // Se valida que todas las filas pertenezcan al mismo empleador (RUC) y se crean los archivos si aún no existen.
            if (!jor) {
                ruc = fila.empresa.ruc;
                nombreJor = nombrePlame(trabajo.periodo, ruc, 'jor');
                nombreRem = nombrePlame(trabajo.periodo, ruc, 'rem');
                jor = escritor(directorio, nombreJor);
                rem = escritor(directorio, nombreRem);
            }

            // Se valida que todas las filas pertenezcan al mismo empleador (RUC).
            if (fila.empresa.ruc !== ruc)
                throw new Error('Una exportación PLAME no puede mezclar empresas.');

            // Se escriben las líneas de jornada y remuneración en los archivos correspondientes.
            await jor.linea(lineaJornadaPlame(fila));

            // Se escriben las líneas de remuneración en el archivo correspondiente para cada línea generada por la función lineasRemuneracionPlame.
            for (const linea of lineasRemuneracionPlame(
                fila,
                trabajo.solicitud.configuracion
            ))
                await rem.linea(linea);
        }

        // Se valida que al menos una fila haya sido procesada para generar los archivos PLAME.
        if (!jor) throw new Error('No hay trabajadores para PLAME.');
        
        // Se cierran los archivos de jornada y remuneración después de procesar todas las filas.
        await jor.cerrar();
        await rem.cerrar();

        // Se devuelven los metadatos de los archivos generados para jornada y remuneración.
        return [
            await metadatos(directorio, nombreJor, 'text/plain'),
            await metadatos(directorio, nombreRem, 'text/plain'),
        ];
    } catch (error) {
        jor?.cancelar();
        rem?.cancelar();
        throw error;
    }
}

/**
 * Genera un archivo CSV con los costos de cada área.
 * @param {*} trabajo - El objeto de trabajo que contiene la información de la tarea.
 * @param {*} filas - Un generador asíncrono que devuelve filas de trabajo.
 * @param {*} directorio - El directorio donde se guardarán los archivos generados.
 * @returns - {Promise<*>} - Un arreglo de objetos que contienen los metadatos del archivo CSV generado.
 * @throws {RangeError} - Si las reducciones de tiempo exceden los ingresos del área.
 */
async function costos(trabajo, filas, directorio) {
    // Se utiliza un Map para acumular los totales por área, evitando la necesidad de múltiples pasadas sobre los datos.
    const areas = new Map();

    // Se procesan las filas de trabajo para acumular los totales por área, incluyendo ingresos, descuentos, neto, reducciones por tiempo y aportes del empleador.
    for await (const fila of filas) {
        // Se obtiene el área de la fila actual y se inicializan los totales si aún no existen para esa área.
        const area = fila.cabecera.area;

        // Se obtienen los totales acumulados para el área actual o se inicializan si aún no existen.
        const totales = areas.get(area) || {
            cantidad: 0,
            ingresos: new Decimal(0),
            descuentos: new Decimal(0),
            neto: new Decimal(0),
            essalud: new Decimal(0),
            vida: new Decimal(0),
            tiempo: new Decimal(0)
        };

        // Se actualizan los totales acumulados para el área actual con los valores de la fila procesada.
        totales.cantidad++;

        // Se suman los valores de ingresos, descuentos, neto, essalud y vida a los totales acumulados para el área actual.
        for (const [destino, fuente] of [
            ['ingresos', 'total_ingresos'],
            ['descuentos', 'total_descuentos'],
            ['neto', 'neto_a_pagar'],
            ['essalud', 'aporte_essalud'],
            ['vida', 'aporte_vida_ley']
        ])
            totales[destino] = totales[destino].plus(fila.resultado[fuente]);
        
        // Las reducciones por tiempo no trabajado disminuyen la remuneración devengada.
        // Impuestos, pensión y adelantos son descuentos distintos y no reducen ese costo.
        for (const campo of [
            'descuento_faltas',
            'descuento_tardanzas',
            'descuento_sin_goce',
            'descuento_dso',
        ]) {
            totales.tiempo = totales.tiempo.plus(fila.resultado[campo]);
        }
        
        // Se valida que las reducciones de tiempo no excedan los ingresos del área, lanzando un error si se cumple la condición.
        if (totales.ingresos.lt(totales.tiempo))
            throw new RangeError('Las reducciones de tiempo exceden los ingresos del área.');
        
        // Se actualizan los totales acumulados para el área actual en el Map de áreas.
        areas.set(area, totales);
    }

    // Se genera un nombre de archivo basado en el período del trabajo y se crea un archivo CSV para almacenar los costos por área.
    const nombre = `COSTOS-${trabajo.periodo}.csv`;
    const archivo = escritor(directorio, nombre, 'utf8');

    // Se escribe la cabecera del archivo CSV con los nombres de las columnas.
    await archivo.linea('area,empleados,ingresos_brutos,descuentos,neto,reducciones_tiempo,remuneracion_devengada,essalud,vida_ley,costo_empleador');
    
    // Se itera sobre cada área y sus totales acumulados para escribir las líneas correspondientes en el archivo CSV.
    for (const [area, t] of areas) {
        // Evitar que un nombre de área se interprete como fórmula al abrir el CSV en Excel.
        const etiqueta = /^[=+@-]/.test(area) ? "'" + area : area;
        
        // Se escribe una línea en el archivo CSV con los valores de cada columna, 
        // asegurando que los valores numéricos se formateen con dos decimales y que las comillas dobles se escapen correctamente.
        await archivo.linea(
            [
                '"' + etiqueta.replace(/"/g, '""') + '"',
                t.cantidad,
                ...[
                    t.ingresos,
                    t.descuentos,
                    t.neto,
                    t.tiempo,
                    t.ingresos.minus(t.tiempo),
                    t.essalud,
                    t.vida,
                    t.ingresos.minus(t.tiempo).plus(t.essalud).plus(t.vida),
                ].map((v) => v.toFixed(2)),
            ].join(',')
        );
    }

    // Se cierra el archivo CSV después de escribir todas las líneas.
    await archivo.cerrar();
    return [await metadatos(directorio, nombre, 'text/csv')];
}

module.exports = { exportar };
