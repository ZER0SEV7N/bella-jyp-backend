//src/modules/payroll/planillas/helpers/gratificacion-planilla.helper.ts
import { ServerTime } from '@/common/utils/server-time';
import { ConflictException } from '@nestjs/common';
import type { historial_planillas, incidencias_mes } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { EntradaPlanilla } from '../domain/planilla.types';

/**
 * Helper para obtener los meses de gratificación de un semestre completo sin casuísticas de beneficios pendientes.
 * Este helper verifica que existan los acumulados previos necesarios antes de calcular la gratificación.
 * Su objetivo es garantizar que la gratificación se pueda calcular correctamente, asegurando la integridad de los datos.
 */
type FuenteSemestre = incidencias_mes | EntradaPlanilla;
type Vinculo = { fecha_inicio: Date; fecha_cese: Date | null };

/**
 * Funcion para obtener la fuente de datos de un semestre completo sin casuísticas de beneficios pendientes.
 * Verifica que existan los acumulados previos necesarios antes de calcular la gratificación.
 * @param registro - Un registro de incidencias_mes o historial_planillas que contiene la información del semestre.
 * @returns - La fuente de datos del semestre, que puede ser incidencias_mes o EntradaPlanilla.
 */
function obtenerFuenteSemestre(registro: incidencias_mes | historial_planillas | undefined): FuenteSemestre {
    //Verificar que el registro exista y contenga la información necesaria para calcular la gratificación
    if (!registro) 
        throw new ConflictException('Faltan meses del semestre para verificar la gratificación.');
    
    //Obtener la fuente de datos del semestre, que puede ser incidencias_mes o EntradaPlanilla
    const fuente = 'faltas' in registro ? registro : (registro.snapshot_calculo as unknown as { entrada?: EntradaPlanilla } | null)?.entrada;
    if (!fuente) 
        throw new ConflictException('El semestre contiene planillas sin instantánea verificable.');
    return fuente;
}

/**
 * Funcion para validar la fuente de datos de un semestre completo sin casuísticas de beneficios pendientes.
 * Verifica que no existan ausentismos ni remuneraciones variables que requieran un cálculo específico de beneficios.
 * @param fuente - La fuente de datos del semestre, que puede ser incidencias_mes o EntradaPlanilla.
 * @throws ConflictException - Si la fuente contiene ausentismos o remuneraciones variables que requieren un cálculo específico de beneficios.
 */
function validarFuenteSemestre(fuente: FuenteSemestre): void {
    //Verificar que no existan ausentismos ni remuneraciones variables que requieran un cálculo específico de beneficios
    if (fuente.faltas > 0 || fuente.dias_sin_goce > 0 || fuente.minutos_sin_goce > 0)
        throw new ConflictException('La gratificación con ausentismo requiere el cálculo específico de beneficios.');
    
    //Verificar que no existan remuneraciones variables que requieran un cálculo específico de beneficios
    const bono = 'bono_extraordinario' in fuente && new Prisma.Decimal(fuente.bono_extraordinario).gt(0);
    if (fuente.minutos_extras_25 > 0 || fuente.minutos_extras_35 > 0 || bono)
        throw new ConflictException('La gratificación con remuneraciones variables requiere verificar su regularidad y promedio.');
}

/**
 * Funcion para obtener los meses de gratificación de un semestre completo sin casuísticas de beneficios pendientes.
 * Verifica que existan los acumulados previos necesarios antes de calcular la gratificación.
 * @param periodo - Periodo en formato 'YYYY-MM' para el cual se está calculando la gratificación.
 * @param empleado - Objeto que contiene la información del vínculo laboral del empleado, incluyendo fecha de inicio y fecha de cese.
 * @param incidencia - Objeto que contiene la información de incidencias del mes actual, incluyendo días de vínculo, días remunerables, faltas y ausentismos.
 * @param cerradas - Arreglo de objetos que contienen la información de los meses cerrados del semestre, incluyendo periodo, estado y snapshot de cálculo.
 * @returns - El número de meses de gratificación del semestre completo sin casuísticas de beneficios pendientes.
 */
export function obtenerMesesGratificacion(periodo: string, empleado: Vinculo, incidencia: incidencias_mes, cerradas: historial_planillas[]): number {
    //La gratificación mensual solo se calcula para semestres completos sin casuísticas de beneficios pendientes.
    const { year, month } = ServerTime.validarPeriodo(periodo);
    //Si el mes no es julio o diciembre, no se calcula la gratificación mensual
    if (month !== 7 && month !== 12) 
        return 0;
    
    //Determinar el rango de meses del semestre completo según el mes actual (julio o diciembre)
    const desde = month === 7 ? 1 : 7,
        hasta = month === 7 ? 6 : 12;
    let meses = 0;
    for (let mes = desde; mes <= hasta; mes++) {
        //Obtener la fecha de inicio y fin del mes actual para verificar el vínculo laboral del empleado
        const inicio = new Date(Date.UTC(year, mes - 1, 1)), fin = new Date(Date.UTC(year, mes, 0));
        
        if (empleado.fecha_inicio > inicio || (empleado.fecha_cese && empleado.fecha_cese < fin)) 
            continue;

        //Obtener el registro del mes actual, que puede ser incidencias_mes o historial_planillas
        const registro = mes === month ? incidencia : cerradas.find((p) => p.periodo === `${year}-${String(mes).padStart(2, '0')}`);
        validarFuenteSemestre(obtenerFuenteSemestre(registro));
        meses++;
    }
    return meses;
}
