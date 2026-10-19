//src/modules/payroll/planillas/use-case/descargarBoleta.useCase.ts
import { ConflictException, Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SalidaPlanilla } from '../domain/planilla.types';
import type { CabezalEmpleado, EmpresaData } from '../helpers/generarBoleta.helper';
import { generateBoletaPdf } from '../helpers/generarBoleta.helper';
import { ObtenerPlanillaUseCase } from './planillas/obtenerPlanilla.useCase';

/**
 * Caso de uso para descargar la boleta de pago de un empleado a partir de una planilla validada.
 * Este caso de uso valida que la planilla esté en estado "CONGELADO" o "DECLARADO" y que tenga una instantánea de cálculo antes de generar el PDF de la boleta.
 * @requires - ObtenerPlanillaUseCase para obtener la planilla y su instantánea de cálculo.
 */
@Injectable()
export class DescargarBoletaUseCase {
    constructor(private readonly obtenerPlanilla: ObtenerPlanillaUseCase) {}

    /**
     * Ejecuta el caso de uso para descargar la boleta de pago de un empleado a partir de una planilla validada.
     * Valida que la planilla esté en estado "CONGELADO" o "DECLARADO" y que tenga una instantánea de cálculo antes de generar el PDF de la boleta.
     * @param id - Identificador de la planilla a partir de la cual se generará la boleta.
     * @returns - Promesa que se resuelve con un objeto que contiene el stream del PDF de la boleta y el nombre del archivo si la operación es exitosa.
     * @throws ConflictException si la planilla no está en estado "CONGELADO" o "DECLARADO" o si no tiene una instantánea de cálculo.
     * @throws NotFoundException si la planilla no existe.
     */
    async execute(id: string) {
        //Se obtiene la planilla y se valida que esté en estado "CONGELADO" o "DECLARADO" y que tenga una instantánea de cálculo.
        const planilla = await this.obtenerPlanilla.execute(id);

        //Valida que la planilla esté en estado "CONGELADO" o "DECLARADO" y que tenga una instantánea de cálculo antes de generar el PDF de la boleta.
        if (!['CONGELADO', 'DECLARADO'].includes(planilla.estado) || !planilla.snapshot_calculo)
            throw new ConflictException('La boleta requiere una planilla validada con su instantánea de cálculo.');

        //Se obtiene la instantánea de cálculo de la planilla y se valida que contenga los datos necesarios para generar la boleta.
        const snapshot = planilla.snapshot_calculo as unknown as { empresa: EmpresaData; cabecera: CabezalEmpleado; resultado: SalidaPlanilla };
        if (!snapshot.empresa || !snapshot.cabecera || !snapshot.resultado)
            throw new ConflictException('La instantánea de esta planilla no permite reconstruir la boleta.');
        
        //Se crea un directorio temporal para almacenar el archivo PDF de la boleta y se genera el PDF utilizando los datos de la instantánea de cálculo.
        const directorio = await mkdtemp(join(tmpdir(), 'jyp-boleta-'));
        const ruta = join(directorio, 'boleta.pdf');

        //Se genera el PDF de la boleta utilizando los datos de la instantánea de cálculo y se devuelve un objeto que contiene el stream del PDF y el nombre del archivo.
        try {
            //Se genera el PDF de la boleta utilizando los datos de la instantánea de cálculo y se devuelve un objeto que contiene el stream del PDF y el nombre del archivo.
            const r = snapshot.resultado;
            await generateBoletaPdf(snapshot.empresa, snapshot.cabecera, r, r, r, r, r, { periodo: planilla.periodo }, ruta);
            const stream = createReadStream(ruta);
            stream.once('close', () => { void rm(directorio, { recursive: true, force: true }); });
            return { stream, nombre: `boleta-${planilla.periodo}-${planilla.id}.pdf` };
        } catch (error) {
            await rm(directorio, { recursive: true, force: true });
            throw error;
        }
    }
}
