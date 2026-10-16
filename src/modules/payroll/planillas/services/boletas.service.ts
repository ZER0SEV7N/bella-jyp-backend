//src/modules/payroll/planillas/services/boletas.service.ts
import { ConflictException, Injectable } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PlanillasService } from './planillas.service';
import { generateBoletaPdf } from '../helpers/generarBoleta.helper';
import type { CabezalEmpleado, EmpresaData } from '../helpers/generarBoleta.helper';
import type { SalidaPlanilla } from '../domain/planilla.types';

/**
 * Servicio para generar y descargar boletas de pago en formato PDF.
 * Este servicio interactúa con el servicio de planillas para obtener los datos necesarios
 * y utiliza un helper para generar el PDF de la boleta.
 */
@Injectable()
export class BoletasService {
    constructor(private readonly planillas: PlanillasService) {}

    async descargar(id: string){
        const planilla = await this.planillas.detalle(id);
        if (!['CONGELADO', 'DECLARADO'].includes(planilla.estado) || !planilla.snapshot_calculo) 
            throw new ConflictException('La boleta requiere una planilla validada con su instantánea de cálculo.');
        
        const snapshot = planilla.snapshot_calculo as unknown as {
            empresa: EmpresaData;
            cabecera: CabezalEmpleado;
            resultado: SalidaPlanilla;
        }
        if (!snapshot.empresa || !snapshot.cabecera || !snapshot.resultado)
            throw new ConflictException('La instantánea de esta planilla no permite reconstruir la boleta.');

        const directorio = await mkdtemp(join(tmpdir(), 'jyp-boleta-'));
        const ruta = join(directorio, 'boleta.pdf');

        //Generación del PDF de la boleta utilizando los datos obtenidos de la planilla
        try{
            //Se asume que la función generateBoletaPdf es asíncrona y maneja la creación del PDF correctamente
            const r = snapshot.resultado;
            await generateBoletaPdf(snapshot.empresa, snapshot.cabecera, r,r,r,r,r, {
                periodo: planilla.periodo
            }, ruta);
            
            //Se crea un stream de lectura del archivo PDF generado
            const stream = createReadStream(ruta);
            stream.once('close', () => {
                void rm(directorio, { recursive: true, force: true });
            });

            //Se retorna el stream y un nombre de archivo sugerido para la descarga
            return { stream, nombre: `boleta-${planilla.periodo}-${planilla.id}.pdf` };
        } catch (error) {
            await rm(directorio, { recursive: true, force: true }); throw error;
        }
    }
}