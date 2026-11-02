//src/workers/calculo-masivo/payroll.processor.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import Piscina from 'piscina';
import type { EntradaPlanilla, SalidaPlanilla } from '@/modules/payroll/planillas/domain/planilla.types';

/**
 * Clase que representa un worker de Piscina para el cálculo masivo de planillas.
 * Utiliza la librería Piscina para manejar la concurrencia y el procesamiento de múltiples trabajos de cálculo de planilla en paralelo.
 * @requires - Piscina para manejar la concurrencia y el procesamiento de trabajos en paralelo.
 * @requires - EntradaPlanilla y SalidaPlanilla para definir los tipos de datos de entrada y salida del cálculo de planilla.
 * @implements OnModuleDestroy - Interfaz que permite ejecutar lógica al destruir el módulo, en este caso, cerrar el worker de Piscina.
 */
@Injectable()
export class PayrollPoolService implements OnModuleDestroy {
    //El limte evita multiplicar la RAM del servidor al ejecutar múltiples workers de Piscina en paralelo, ya que cada worker puede consumir una cantidad significativa de memoria.
    private readonly piscina = new Piscina<EntradaPlanilla, SalidaPlanilla>({
        filename: join(__dirname, 'calcular-planilla.worker.js'), minThreads: 1, //filename: join(__dirname, 'calcular-planilla.worker.js'), minThreads: 1, //file name del worker que ejecutará la función de cálculo de planilla
        maxThreads: Math.max(1, Math.min(4, availableParallelism() - 1)), maxQueue: 100, idleTimeout: 30000 //maxThreads: 4, maxQueue: 100, idleTimeout: 30000 <-- Ajusta estos valores según la capacidad de tu servidor y la carga esperada de trabajo
    });

    calcular(entrada: EntradaPlanilla): Promise<SalidaPlanilla> { return this.piscina.run(entrada); }
    async onModuleDestroy(): Promise<void> { await this.piscina.destroy(); }
}