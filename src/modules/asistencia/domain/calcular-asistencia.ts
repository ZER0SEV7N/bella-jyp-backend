import { ServerTime } from '../../../common/utils/server-time';
import type { ContextoAsistencia, MarcaDia, ResultadoAsistencia, ResultadoDia } from './asistencia.types';
import { feriadosNacionalesPeru } from './calendario-peru';
import { evaluarFecha } from './evaluar-dia';
import { diasMedicosAcumulados } from './solicitudes-asistencia';

export const VERSION_MOTOR_ASISTENCIA = '2026-10-15.1';

/** El mes completo conserva la base mensual de treinta; un vínculo parcial conserva sus días efectivos. */
export function diasDeVinculo(inicio: string, cese: string | null, periodo: string): number {
    const { year, month } = ServerTime.validarPeriodo(periodo);
    const primero = `${periodo}-01`,
        ultimo = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const desde = inicio > primero ? inicio : primero,
        hasta = cese && cese < ultimo ? cese : ultimo;
    if (desde > hasta) return 0;
    if (desde === primero && hasta === ultimo) return 30;
    return Math.min(30, Math.round((ServerTime.desdeFechaSimple(hasta).getTime() - ServerTime.desdeFechaSimple(desde).getTime()) / 86400000) + 1);
}

/** Motor determinista: no lee el reloj, la base de datos ni Redis. */
export function calcularAsistencia(contexto: ContextoAsistencia): ResultadoAsistencia {
    const { year, month } = ServerTime.validarPeriodo(contexto.periodo);
    const dias = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const descansos = new Map([...feriadosNacionalesPeru(year), ...contexto.descansos].map((d) => [d.fecha, d.nombre]));
    const marcasPorDia = new Map<string, MarcaDia[]>();
    for (const m of [...contexto.marcaciones].sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora))) {
        const instante = new Date(m.fecha_hora),
            fecha = ServerTime.fechaPeru(instante);
        const hora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instante);
        const marcas = marcasPorDia.get(fecha) ?? [];
        marcas.push({ id: m.id, tipo: m.tipo_marcacion, hora, origen: m.metodo });
        marcasPorDia.set(fecha, marcas);
    }
    const detalle = Array.from({ length: dias }, (_, indice) => {
        const fecha = `${contexto.periodo}-${String(indice + 1).padStart(2, '0')}`;
        return evaluarFecha(contexto, fecha, marcasPorDia.get(fecha) ?? [], descansos);
    });
    if (contexto.solicitudes.some((s) => !s.fecha_inicio || !s.fecha_fin))
        (detalle.find((d) => d.estado !== 'FUERA_DE_VINCULO') ?? detalle[0]).alertas.push('SOLICITUD_DE_ASISTENCIA_SIN_FECHAS');
    const medicasDelMes = contexto.solicitudes.filter(
        (s) =>
            s.tipo === 'LICENCIA_MEDICA' &&
            s.estado === 'APROBADA' &&
            s.fecha_inicio &&
            s.fecha_fin &&
            s.fecha_inicio.slice(0, 7) <= contexto.periodo &&
            s.fecha_fin.slice(0, 7) >= contexto.periodo
    );
    if (
        medicasDelMes.some(
            (s) =>
                s.efecto_asistencia === 'SUBSIDIO' ||
                (s.efecto_asistencia === 'CON_GOCE' &&
                    diasMedicosAcumulados(
                        contexto.solicitudes,
                        s.fecha_fin!.slice(0, 7) === contexto.periodo ? s.fecha_fin! : `${contexto.periodo}-${String(dias).padStart(2, '0')}`
                    ) > 20)
        )
    )
        (detalle.find((d) => d.estado !== 'FUERA_DE_VINCULO') ?? detalle[0]).alertas.push('INCAPACIDAD_MEDICA_REQUIERE_REVISION_DE_SUBSIDIOS');
    const sumar = (campo: keyof ResultadoDia) => detalle.reduce((total, d) => total + Number(d[campo]), 0);
    const base = contexto.empleado.fecha_inicio ? diasDeVinculo(contexto.empleado.fecha_inicio, contexto.empleado.fecha_cese, contexto.periodo) : 0;
    const faltas = Math.min(base, sumar('falta'));
    const diasSinGoce = Math.min(
        base - faltas,
        detalle.filter((d) => d.estado !== 'FUERA_DE_VINCULO').every((d) => d.sin_goce === 1) ? base : sumar('sin_goce')
    );
    return {
        periodo: contexto.periodo,
        dias_vinculo: base,
        dias_trabajados: Math.max(0, base - faltas - diasSinGoce),
        faltas,
        dias_sin_goce: diasSinGoce,
        minutos_sin_goce: sumar('minutos_sin_goce'),
        minutos_tardanza: sumar('minutos_tardanza'),
        minutos_salida_anticipada: sumar('minutos_salida_anticipada'),
        minutos_extras_25: sumar('minutos_extra_25'),
        minutos_extras_35: sumar('minutos_extra_35'),
        pendientes: detalle.filter((d) => d.alertas.length > 0).length,
        completo: detalle.every((d) => d.estado !== 'NO_EVALUADO'),
        detalle,
        version_motor: VERSION_MOTOR_ASISTENCIA
    };
}
