import { calcularAsistencia } from '@/modules/asistencia/domain/calcular-asistencia';
import type {ContextoAsistencia, HorarioDia, SolicitudAsistencia} from '@/modules/asistencia/domain/asistencia.types';
import type { EntradaPlanilla } from '@/modules/payroll/planillas/domain/planilla.types';

/**
 * Fixtures para pruebas unitarias de los motores de cálculo de asistencia y planillas.
 * Se incluyen funciones para generar contextos de asistencia, horarios, solicitudes y entradas de planilla.
 * Se proporciona un conjunto de días de la semana y un horario base para pruebas.
 * Las funciones permiten modificar marcaciones y crear solicitudes de asistencia con efectos específicos.
 * Se asegura que los datos de prueba sean consistentes y representativos para validar la lógica de negocio.
 */
export const dias = [
    'DOMINGO',
    'LUNES',
    'MARTES',
    'MIERCOLES',
    'JUEVES',
    'VIERNES',
    'SABADO',
];

// Horario base de 9:00 a 18:00 con descanso de 13:00 a 14:00, lunes a viernes, martes remoto.
export const horario: HorarioDia[] = dias.map((dia, indice) => ({
    dia,
    laborable: indice > 0 && indice < 6,
    modalidad: dia === 'MARTES' ? 'REMOTO' : 'PRESENCIAL',
    entrada: '09:00',
    inicio_descanso: '13:00',
    fin_descanso: '14:00',
    salida: '18:00',
}));

// Horario base de 9:00 a 18:00 con descanso de 13:00 a 14:00, lunes a sábado, martes remoto.
export function contexto(): ContextoAsistencia {
    const marcaciones = [];
    for (let dia = 1; dia <= 30; dia++) {
        const fecha = `2026-09-${String(dia).padStart(2, '0')}`;
        if ([0, 6].includes(new Date(`${fecha}T00:00:00Z`).getUTCDay()))
            continue;
        for (const [tipo, hora] of [
            ['ENTRADA', '09:00'],
            ['SALIDA', '18:00'],
        ])
            marcaciones.push({
                id: `${fecha}-${tipo}`,
                fecha_hora: `${fecha}T${hora}:00-05:00`,
                tipo_marcacion:
                    tipo as ContextoAsistencia['marcaciones'][number]['tipo_marcacion'],
                metodo: 'BIOMETRICO_EXCEL',
            });
    }
    return {
        periodo: '2026-09',
        ahora: '2026-10-15T16:00:00Z',
        empleado: {
            id: 'empleado',
            fecha_inicio: '2026-09-01',
            fecha_cese: null,
        },
        jornadas: [
            {
                desde: '2026-09-01',
                horario,
                tolerancia_minutos: 5,
                politica_tolerancia: 'COMPLETA',
                minutos_semana: 2400,
            },
        ],
        marcaciones,
        solicitudes: [],
        decisiones: [],
        descansos: [],
    };
}
export function cambiarMarcas(ctx: ContextoAsistencia, pares: string[][]) {
    ctx.marcaciones = ctx.marcaciones.filter(
        (m) => !m.id.startsWith('2026-09-01')
    );
    for (const [tipo, hora] of pares)
        ctx.marcaciones.push({
            id: tipo,
            fecha_hora: `2026-09-01T${hora}:00-05:00`,
            tipo_marcacion:
                tipo as ContextoAsistencia['marcaciones'][number]['tipo_marcacion'],
            metodo: 'MANUAL',
        });
}
export const dia = (ctx: ContextoAsistencia) =>
    calcularAsistencia(ctx).detalle[0];
export const solicitud = (
    efecto: string,
    desde: string | null = '09:00',
    hasta: string | null = '10:00'
): SolicitudAsistencia => ({
    id: 'solicitud',
    tipo: 'PERMISO',
    estado: 'APROBADA',
    fecha_inicio: '2026-09-01',
    fecha_fin: '2026-09-01',
    hora_inicio: desde,
    hora_fin: hasta,
    efecto_asistencia: efecto,
});
export function entrada(): EntradaPlanilla {
    return {
        periodo: '2026-09',
        empleado_id: 'empleado',
        sueldo_basico: '1500',
        asignacion_familiar: false,
        dias_vinculo: 30,
        dias_remunerables: 30,
        faltas: 0,
        dias_sin_goce: 0,
        minutos_tardanza: 0,
        minutos_salida_anticipada: 0,
        minutos_sin_goce: 0,
        minutos_extras_25: 0,
        minutos_extras_35: 0,
        horas_diarias: '8',
        regimen: 'ONP',
        tipo_comision: null,
        regimen_salud: 'ESSALUD_REGULAR',
        eps_adicional: '0',
        afp: null,
        parametros: {
            RMV: '1130',
            UIT: '5500',
            ESSALUD_PCT: '0.09',
            ONP_PCT: '0.13',
            VIDA_LEY_PCT: '0.0125',
        },
        ingresos_previos: '12000',
        retenciones_hasta_corte: '0',
        gratificaciones_previas: '0',
        meses_gratificacion: 0,
        adelantos_desembolsados: '0',
        bono_extraordinario: '0',
        descuento_autorizado: '0',
        descuento_dso: null,
    };
}
export const horario48 = () =>
    horario.map((d) => ({ ...d, laborable: d.dia !== 'DOMINGO' }));
