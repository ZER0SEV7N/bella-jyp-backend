const Decimal = require('decimal.js');
const { createReadStream } = require('node:fs');
const { unlink } = require('node:fs/promises');
const { pipeline } = require('node:stream/promises');
const { join } = require('node:path');
const { escritor, metadatos } = require('./almacenamiento.cjs');
const {
    cabeceraBcp,
    detalleBcp,
} = require('../../dist/modules/integraciones/domain/bcp-haberes');
const {
    lineaAfpnet,
} = require('../../dist/modules/integraciones/domain/afpnet');
const {
    lineaJornadaPlame,
    lineasRemuneracionPlame,
    nombrePlame,
} = require('../../dist/modules/integraciones/domain/plame');

/** Exporta un único formato confirmado. Los canales bancarios sin diseño homologado se rechazan. */
async function exportar(trabajo, filas, directorio) {
    if (trabajo.tipo === 'BCP_HABERES') return bcp(trabajo, filas, directorio);
    if (trabajo.tipo === 'AFPNET') return afpnet(trabajo, filas, directorio);
    if (trabajo.tipo === 'PLAME') return plame(trabajo, filas, directorio);
    if (trabajo.tipo === 'COSTOS') return costos(trabajo, filas, directorio);
    throw new Error('El formato solicitado no tiene un generador homologado.');
}

async function bcp(trabajo, filas, directorio) {
    const config = trabajo.solicitud.configuracion;
    const detalle = escritor(directorio, 'abonos.tmp');
    let total = new Decimal(0),
        control = 0n,
        cantidad = 0,
        ruc;
    try {
        for await (const fila of filas) {
            ruc ??= fila.empresa.ruc;
            if (fila.empresa.ruc !== ruc)
                throw new Error('El archivo BCP no puede mezclar empleadores.');
            const pago = detalleBcp(fila, config);
            total = total.plus(pago.importe);
            control += pago.control;
            cantidad++;
            await detalle.linea(pago.linea);
        }
        await detalle.cerrar();
        const nombre = `BCP-HABERES-${trabajo.periodo}.txt`;
        const archivo = escritor(directorio, nombre);
        await archivo.linea(
            cabeceraBcp(config, cantidad, total.toFixed(2), control)
        );
        // El detalle se copia por stream después de la cabecera calculada, sin un buffer masivo.
        await pipeline(
            createReadStream(join(directorio, 'abonos.tmp')),
            archivo.stream,
            { end: false }
        );
        await archivo.cerrar();
        await unlink(join(directorio, 'abonos.tmp'));
        return [await metadatos(directorio, nombre, 'text/plain')];
    } catch (error) {
        detalle.cancelar();
        throw error;
    }
}

async function afpnet(trabajo, filas, directorio) {
    const nombre = `AFPNET-${trabajo.periodo}.txt`;
    const archivo = escritor(directorio, nombre);
    let secuencia = 0,
        ruc;
    try {
        for await (const fila of filas) {
            ruc ??= fila.empresa.ruc;
            if (fila.empresa.ruc !== ruc)
                throw new Error(
                    'El archivo AFPnet no puede mezclar empleadores.'
                );
            if (fila.regimen === 'AFP')
                await archivo.linea(
                    lineaAfpnet(
                        fila,
                        ++secuencia,
                        trabajo.solicitud.configuracion
                    )
                );
        }
        if (!secuencia)
            throw new Error(
                'No existen afiliados al SPP dentro de la selección.'
            );
        await archivo.cerrar();
        return [await metadatos(directorio, nombre, 'text/plain')];
    } catch (error) {
        archivo.cancelar();
        throw error;
    }
}

async function plame(trabajo, filas, directorio) {
    let jor, rem, nombreJor, nombreRem, ruc;
    try {
        for await (const fila of filas) {
            if (!jor) {
                ruc = fila.empresa.ruc;
                nombreJor = nombrePlame(trabajo.periodo, ruc, 'jor');
                nombreRem = nombrePlame(trabajo.periodo, ruc, 'rem');
                jor = escritor(directorio, nombreJor);
                rem = escritor(directorio, nombreRem);
            }
            if (fila.empresa.ruc !== ruc)
                throw new Error(
                    'Una exportación PLAME no puede mezclar empresas.'
                );
            await jor.linea(lineaJornadaPlame(fila));
            for (const linea of lineasRemuneracionPlame(
                fila,
                trabajo.solicitud.configuracion
            ))
                await rem.linea(linea);
        }
        if (!jor) throw new Error('No hay trabajadores para PLAME.');
        await jor.cerrar();
        await rem.cerrar();
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

async function costos(trabajo, filas, directorio) {
    const areas = new Map();
    for await (const fila of filas) {
        const area = fila.cabecera.area;
        const totales = areas.get(area) || {
            cantidad: 0,
            ingresos: new Decimal(0),
            descuentos: new Decimal(0),
            neto: new Decimal(0),
            essalud: new Decimal(0),
            vida: new Decimal(0),
            tiempo: new Decimal(0),
        };
        totales.cantidad++;
        for (const [destino, fuente] of [
            ['ingresos', 'total_ingresos'],
            ['descuentos', 'total_descuentos'],
            ['neto', 'neto_a_pagar'],
            ['essalud', 'aporte_essalud'],
            ['vida', 'aporte_vida_ley'],
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
        if (totales.ingresos.lt(totales.tiempo))
            throw new RangeError(
                'Las reducciones de tiempo exceden los ingresos del área.'
            );
        areas.set(area, totales);
    }
    const nombre = `COSTOS-${trabajo.periodo}.csv`;
    const archivo = escritor(directorio, nombre, 'utf8');
    await archivo.linea(
        'area,empleados,ingresos_brutos,descuentos,neto,reducciones_tiempo,remuneracion_devengada,essalud,vida_ley,costo_empleador'
    );
    for (const [area, t] of areas) {
        // Evitar que un nombre de área se interprete como fórmula al abrir el CSV en Excel.
        const etiqueta = /^[=+@-]/.test(area) ? "'" + area : area;
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
    await archivo.cerrar();
    return [await metadatos(directorio, nombre, 'text/csv')];
}

module.exports = { exportar };
