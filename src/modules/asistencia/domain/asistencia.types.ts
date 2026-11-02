//src/modules/asistencia/domain/asistencia.types.ts
/**
 * Este archivo define los tipos y estructuras de datos utilizados en el módulo de asistencia.
 * Contiene definiciones para tipos de marcaciones, horarios, jornadas históricas, solicitudes de asistencia,
 * decisiones de asistencia, contexto de asistencia y resultados de asistencia.
 * Estos tipos son utilizados en los casos de uso y servicios del módulo para garantizar la consistencia y tipado fuerte en TypeScript.
 */

//Tipo de marcación de asistencia, que puede ser de entrada, salida de almuerzo, entrada de almuerzo o salida.
export type TipoMarca = 'ENTRADA' | 'SALIDA_ALMUERZO' | 'ENTRADA_ALMUERZO' | 'SALIDA';

//Interface para representar una marca de asistencia, incluyendo el tipo de marca, la hora y opcionalmente un identificador y el origen de la marca.
export interface MarcaDia { tipo: TipoMarca; hora: string; id?: string; origen?: string; }

//Interface para representar el horario de un día, incluyendo si es laborable, la modalidad, las horas de entrada y salida, y los descansos.
export interface HorarioDia { dia: string; laborable: boolean; modalidad?: string; entrada?: string | null; salida?: string | null; inicio_descanso?: string | null; fin_descanso?: string | null; }

//Interface para representar una jornada histórica de un empleado, incluyendo el período de validez, el horario diario, la tolerancia y la política de tolerancia.
export interface JornadaHistorica {
    desde: string; horario: HorarioDia[]; tolerancia_minutos: number;
    politica_tolerancia: 'COMPLETA' | 'EXCESO'; minutos_semana: number;
}

//Interface para representar una solicitud de asistencia, incluyendo su identificador, tipo, estado, fechas y horas de inicio y fin, y el efecto en la asistencia.
export interface SolicitudAsistencia {
    id: string; tipo: string; estado: string; fecha_inicio: string | null; fecha_fin: string | null;
    hora_inicio: string | null; hora_fin: string | null; efecto_asistencia: string;
}

//Interface para representar una decisión de asistencia, incluyendo la fecha, el tipo de decisión, los datos asociados y el motivo de la decisión.
export interface DecisionAsistencia { fecha: string; tipo: string; datos: Record<string, unknown>; motivo: string; }

//Interface para representar el contexto de asistencia de un empleado, incluyendo el período, la fecha actual, la información del empleado, las jornadas históricas, las marcaciones, las solicitudes, las decisiones y los descansos adicionales.
export interface ContextoAsistencia {
    periodo: string; ahora: string;
    empleado: { id: string; fecha_inicio: string | null; fecha_cese: string | null };
    jornadas: JornadaHistorica[];
    marcaciones: { id: string; fecha_hora: string; tipo_marcacion: TipoMarca; metodo: string }[];
    solicitudes: SolicitudAsistencia[]; decisiones: DecisionAsistencia[];
    descansos: { fecha: string; nombre: string }[];
}

//Interface para representar el resultado de la asistencia de un empleado, incluyendo el período, los días trabajados, las faltas, los minutos de tardanza y salida anticipada, los minutos sin goce, los minutos extras, las solicitudes pendientes, si la asistencia está completa y el detalle diario de la asistencia.
export interface ResultadoDia {
    fecha: string; estado: string; modalidad: string | null; marcas: MarcaDia[]; solicitudes: string[];
    minutos_programados: number; minutos_trabajados: number; minutos_tardanza: number;
    minutos_salida_anticipada: number; minutos_sin_goce: number;
    minutos_extra_observados: number; minutos_extra_25: number; minutos_extra_35: number;
    falta: number; sin_goce: number; alertas: string[];
}

//Interface para representar el resultado de la asistencia de un empleado, incluyendo el período, los días trabajados, las faltas, los minutos de tardanza y salida anticipada, los minutos sin goce, los minutos extras, las solicitudes pendientes, si la asistencia está completa y el detalle diario de la asistencia.
export interface ResultadoAsistencia {
    periodo: string; dias_vinculo: number; dias_trabajados: number; faltas: number; dias_sin_goce: number;
    minutos_tardanza: number; minutos_salida_anticipada: number; minutos_sin_goce: number;
    minutos_extras_25: number; minutos_extras_35: number; pendientes: number; completo: boolean;
    detalle: ResultadoDia[]; version_motor: string;
}
