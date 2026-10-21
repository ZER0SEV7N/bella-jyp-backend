//src/modules/asistencia/domain/asistencia.types.ts
/**
 * Este archivo define los tipos y estructuras de datos utilizados en el módulo de asistencia.
 * Contiene definiciones para tipos de marcaciones, horarios, jornadas históricas, solicitudes de asistencia,
 * decisiones de asistencia, contexto de asistencia y resultados de asistencia.
 * Estos tipos son utilizados en los casos de uso y servicios del módulo para garantizar la consistencia y tipado fuerte en TypeScript.
 */

export type TipoMarca = 'ENTRADA' | 'SALIDA_ALMUERZO' | 'ENTRADA_ALMUERZO' | 'SALIDA';

export interface MarcaDia { tipo: TipoMarca; hora: string; id?: string; origen?: string; }

export interface HorarioDia { dia: string; laborable: boolean; modalidad?: string; entrada?: string | null; salida?: string | null; inicio_descanso?: string | null; fin_descanso?: string | null; }


export interface JornadaHistorica {
    desde: string; horario: HorarioDia[]; tolerancia_minutos: number;
    politica_tolerancia: 'COMPLETA' | 'EXCESO'; minutos_semana: number;
}
export interface SolicitudAsistencia {
    id: string; tipo: string; estado: string; fecha_inicio: string | null; fecha_fin: string | null;
    hora_inicio: string | null; hora_fin: string | null; efecto_asistencia: string;
}

export interface DecisionAsistencia { fecha: string; tipo: string; datos: Record<string, unknown>; motivo: string; }

export interface ContextoAsistencia {
    periodo: string; ahora: string;
    empleado: { id: string; fecha_inicio: string | null; fecha_cese: string | null };
    jornadas: JornadaHistorica[];
    marcaciones: { id: string; fecha_hora: string; tipo_marcacion: TipoMarca; metodo: string }[];
    solicitudes: SolicitudAsistencia[]; decisiones: DecisionAsistencia[];
    descansos: { fecha: string; nombre: string }[];
}

export interface ResultadoDia {
    fecha: string; estado: string; modalidad: string | null; marcas: MarcaDia[]; solicitudes: string[];
    minutos_programados: number; minutos_trabajados: number; minutos_tardanza: number;
    minutos_salida_anticipada: number; minutos_sin_goce: number;
    minutos_extra_observados: number; minutos_extra_25: number; minutos_extra_35: number;
    falta: number; sin_goce: number; alertas: string[];
}

export interface ResultadoAsistencia {
    periodo: string; dias_vinculo: number; dias_trabajados: number; faltas: number; dias_sin_goce: number;
    minutos_tardanza: number; minutos_salida_anticipada: number; minutos_sin_goce: number;
    minutos_extras_25: number; minutos_extras_35: number; pendientes: number; completo: boolean;
    detalle: ResultadoDia[]; version_motor: string;
}
