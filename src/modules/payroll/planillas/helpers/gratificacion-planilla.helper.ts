import { ServerTime } from '@/common/utils/server-time';
import { ConflictException } from '@nestjs/common';
import type { historial_planillas, incidencias_mes } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { EntradaPlanilla } from '../domain/planilla.types';

type FuenteSemestre = incidencias_mes | EntradaPlanilla;
type Vinculo = { fecha_inicio: Date; fecha_cese: Date | null };

/** Los meses anteriores se verifican con su instantánea, no con los datos actuales del colaborador. */
function obtenerFuenteSemestre(registro: incidencias_mes | historial_planillas | undefined): FuenteSemestre {
    if (!registro) throw new ConflictException('Faltan meses del semestre para verificar la gratificación.');
    const fuente = 'faltas' in registro ? registro : (registro.snapshot_calculo as unknown as { entrada?: EntradaPlanilla } | null)?.entrada;
    if (!fuente) throw new ConflictException('El semestre contiene planillas sin instantánea verificable.');
    return fuente;
}

/** El motor mensual conserva el bloqueo de casuísticas que necesitan beneficios específicos. */
function validarFuenteSemestre(fuente: FuenteSemestre): void {
    if (fuente.faltas > 0 || fuente.dias_sin_goce > 0 || fuente.minutos_sin_goce > 0)
        throw new ConflictException('La gratificación con ausentismo requiere el cálculo específico de beneficios.');
    const bono = 'bono_extraordinario' in fuente && new Prisma.Decimal(fuente.bono_extraordinario).gt(0);
    if (fuente.minutos_extras_25 > 0 || fuente.minutos_extras_35 > 0 || bono)
        throw new ConflictException('La gratificación con remuneraciones variables requiere verificar su regularidad y promedio.');
}

/** Cuenta meses calendario completos del vínculo, sin contar filas como meses trabajados. */
export function obtenerMesesGratificacion(periodo: string, empleado: Vinculo, incidencia: incidencias_mes, cerradas: historial_planillas[]): number {
    //La gratificación mensual solo se calcula para semestres completos sin casuísticas de beneficios pendientes.
    const { year, month } = ServerTime.validarPeriodo(periodo);
    if (month !== 7 && month !== 12) return 0;
    const desde = month === 7 ? 1 : 7,
        hasta = month === 7 ? 6 : 12;
    let meses = 0;
    for (let mes = desde; mes <= hasta; mes++) {
        const inicio = new Date(Date.UTC(year, mes - 1, 1)),
            fin = new Date(Date.UTC(year, mes, 0));
        if (empleado.fecha_inicio > inicio || (empleado.fecha_cese && empleado.fecha_cese < fin)) continue;
        const registro = mes === month ? incidencia : cerradas.find((p) => p.periodo === `${year}-${String(mes).padStart(2, '0')}`);
        validarFuenteSemestre(obtenerFuenteSemestre(registro));
        meses++;
    }
    return meses;
}
