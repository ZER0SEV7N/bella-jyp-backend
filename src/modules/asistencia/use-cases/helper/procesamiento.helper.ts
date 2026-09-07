import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { GenerarIncidenciasPeriodoDto } from '@jyp/shared-contracts';

//Interfaz para el horario diario configurado en la jornada (JSONB)
export interface DiaHorario {
  dia: string;
  laborable: boolean;
  entrada?: string | null;
  salida?: string | null;
}

//Mapa de días según getUTCDay() (0 = Domingo, 6 = Sábado)
export const DIAS_MAP: Record<number, string> = {
  0: 'DOMINGO',
  1: 'LUNES',
  2: 'MARTES',
  3: 'MIERCOLES',
  4: 'JUEVES',
  5: 'VIERNES',
  6: 'SABADO'
};

//Offset fijo de Perú (UTC-5) en minutos (-300)
export const PERU_TIMEZONE_OFFSET_MINUTES = -5 * 60;

/**
 * Metodo auxiliar para obtener el año, mes y rango de fechas del período especificado.
 * @param periodo - String en formato 'YYYY-MM' que representa el período a procesar.
 * @returns Un objeto con el año, mes, fecha de inicio y fin del mes, y la cantidad de días del mes.
 * @throws BadRequestException - Si el formato del período es inválido.
 */
export function obtenerPeriodo(periodo: string) {
    //Validación del formato del período
    const [year, month] = periodo.split('-').map(Number);
    //Rango mensual en UTC
    const fechaInicioMes = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const fechaFinMes = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    return { year, month, fechaInicioMes, fechaFinMes, diasDelMes: fechaFinMes.getUTCDate() };
}

/**
 * Método auxiliar para obtener los colaboradores activos según los filtros especificados en el DTO.
 * @param dto - Dto que contiene los filtros opcionales para empleados y áreas.
 * @param periodo - Objeto que contiene el año, mes y rango de fechas del período a procesar.
 * @returns Una lista de empleados activos que cumplen con los criterios especificados, incluyendo sus horarios, solicitudes aprobadas y registros de asistencia.
 * @throws NotFoundException - Si no se encuentran empleados activos para procesar.
 */
export async function obtenerColaboradores(prisma: PrismaService, dto: GenerarIncidenciasPeriodoDto, periodo: ReturnType<typeof obtenerPeriodo>) {
    //Construcción de la condición de búsqueda para empleados activos
    const whereEmpleado: Record<string, any> = { activo: true, deleted_at: null };
    if (dto.empleado_id) whereEmpleado.id = dto.empleado_id;
    if (dto.area_id) whereEmpleado.area_id = dto.area_id;

    //Consulta a la base de datos para obtener los empleados activos con sus horarios, solicitudes aprobadas y registros de asistencia
    return await prisma.empleados.findMany({
        where: whereEmpleado,
        include: {
            jornada: true,
            solicitudes: {
                where: {
                    estado: 'APROBADA',
                    deleted_at: null,
                    OR: [{
                        fecha_inicio: { lte: periodo.fechaFinMes },
                        fecha_fin: { gte: periodo.fechaInicioMes }
                    }]
                }
            },
            asistencias: {
                where: {
                    fecha_hora: {
                        gte: new Date(periodo.fechaInicioMes.getTime() - 24 * 60 * 60 * 1000), // Margen de 1 día para turnos de noche
                        lte: new Date(periodo.fechaFinMes.getTime() + 24 * 60 * 60 * 1000)
                    }
                }
            }
        }
    });
}

    /**
     * Metodo que procesa la información de un colaborador para generar las incidencias del mes.
     * @param emp - El colaborador a procesar.
     * @param periodoTexto - El texto que representa el período.
     * @param periodo - El objeto que contiene el año, mes y rango de fechas del período a procesar.
     * @returns Un objeto con la información de las incidencias generadas para el colaborador.
     */
export async function procesarColaborador(prisma: PrismaService, emp: any, periodoTexto: string, periodo: ReturnType<typeof obtenerPeriodo>) {
    const horario: DiaHorario[] = emp.jornada?.horario_semanal || [];
    const marcaciones = indexarMarcacionesPeru(emp.asistencias);

    let faltas = 0;
    let tardanza = 0;

    for (let dia = 1; dia <= periodo.diasDelMes; dia++) {
        const resultado = evaluarDia(emp, dia, periodo, horario, marcaciones);
        faltas += resultado.falta;
        tardanza += resultado.tardanza;
    }

    const base = calcularDiasBase(emp, periodo);
    const diasComputables = Math.max(0, base - faltas);

    await prisma.incidencias_mes.upsert({
        where: { empleado_id_periodo: { empleado_id: emp.id, periodo: periodoTexto } },
        create: {
            id: IdentityGenerator.generateId(),
            empleado_id: emp.id,
            periodo: periodoTexto,
            dias_trabajados: diasComputables,
            faltas,
            minutos_tardanza: tardanza,
            estado: 'PENDIENTE'
        },
        update: {
            dias_trabajados: diasComputables,
            faltas,
            minutos_tardanza: tardanza
        }
    });

    return {
        empleado_id: emp.id,
        nombre_completo: `${emp.nombre} ${emp.apellido}`,
        nro_documento: emp.nro_documento,
        periodo: periodoTexto,
        dias_computables: diasComputables,
        faltas,
        minutos_tardanza: tardanza
    };
}

/**
 * Convierte y agrupa las marcaciones usando la hora local de Perú (UTC-5)
 * @param asistencias - Lista de registros de asistencia del colaborador.
 * @returns - Un mapa donde la clave es la fecha en formato 'YYYY-MM-DD' y el valor es un arreglo de objetos que contienen la hora local en minutos.
 * Este método filtra las marcaciones de tipo 'ENTRADA', ajusta la hora a la zona horaria de Perú y agrupa las horas locales por fecha.
 * Se utiliza para evaluar faltas y tardanzas en el procesamiento de incidencias.
 */
export function indexarMarcacionesPeru(asistencias: any[]) {
    const resultado = new Map<string, { horaLocalMinutos: number }[]>();

    asistencias.filter((a) => a.tipo_marcacion === 'ENTRADA').forEach((a) => {
        const fechaUtc = new Date(a.fecha_hora);
        const fechaPeru = new Date(fechaUtc.getTime() + PERU_TIMEZONE_OFFSET_MINUTES * 60 * 1000);

        const fechaClave = fechaPeru.toISOString().split('T')[0];
        const horaLocalMinutos = fechaPeru.getUTCHours() * 60 + fechaPeru.getUTCMinutes();

        const lista = resultado.get(fechaClave) || [];
        lista.push({ horaLocalMinutos });
        resultado.set(fechaClave, lista);
    });

    return resultado;
}

/**
 * Metodo que evalúa un día específico para determinar si hay falta o tardanza según el horario del colaborador y sus marcaciones.
 * @param emp - El colaborador a evaluar.
 * @param dia - El día del mes a evaluar (1-31).
 * @param periodo - El objeto que contiene el año, mes y rango de fechas del período a procesar.
 * @param horario - Arreglo que representa la configuración de horario semanal del colaborador.
 * @param marcaciones - Mapa que contiene las marcaciones de entrada del colaborador agrupadas por fecha.
 * @returns - Un objeto con las propiedades 'falta' y 'tardanza', donde 'falta' es 1 si el colaborador no marcó entrada en un día laboral sin solicitud aprobada, 
 * y 'tardanza' es la cantidad de minutos de tardanza si la primera entrada fue después del horario programado más la tolerancia.
 * Este método considera la fecha de inicio y cese del colaborador, los días de descanso, los permisos o solicitudes aprobadas, 
 * y calcula la diferencia entre la hora programada y la primera marcación de entrada para determinar la tardanza.
 * Se utiliza en el procesamiento de incidencias para generar el registro correspondiente en la base de datos.
 */
export function evaluarDia(emp: any, dia: number, periodo: ReturnType<typeof obtenerPeriodo>, horario: DiaHorario[], marcaciones: Map<string, { horaLocalMinutos: number }[]>) {
    const fecha = new Date(Date.UTC(periodo.year, periodo.month - 1, dia));

    //Si aún no ingresaba o ya cesó, no genera faltas ni tardanzas
    if (emp.fecha_inicio && fecha < new Date(emp.fecha_inicio)) return { falta: 0, tardanza: 0 };
    if (emp.fecha_cese && fecha > new Date(emp.fecha_cese)) return { falta: 0, tardanza: 0 };

    const config = horario.find((h) => h.dia === DIAS_MAP[fecha.getUTCDay()]);

    //Día de descanso o sin horario asignado
    if (!config?.laborable || !config.entrada) return { falta: 0, tardanza: 0 };

    //Si tiene permiso o descanso justificado legalmente
    const tienePermiso = emp.solicitudes.some((s: any) => s.fecha_inicio && s.fecha_fin && fecha >= new Date(s.fecha_inicio) && fecha <= new Date(s.fecha_fin));
    if (tienePermiso) return { falta: 0, tardanza: 0 };

    const claveFecha = fecha.toISOString().split('T')[0];
    const entradas = marcaciones.get(claveFecha) || [];

    //Falta: No marcó entrada en un día laboral y no tiene solicitud aprobada
    if (!entradas.length) return { falta: 1, tardanza: 0 };

    //Calcular tardanza comparando minutos en la misma zona horaria
    const [h, m] = config.entrada.split(':').map(Number);
    const minutosProgramados = h * 60 + m;

    entradas.sort((a, b) => a.horaLocalMinutos - b.horaLocalMinutos);
    const primeraEntrada = entradas[0].horaLocalMinutos;

    const diferencia = primeraEntrada - minutosProgramados;
    const tolerancia = emp.jornada?.tolerancia_minutos ?? 5;

    return {
        falta: 0,
        tardanza: diferencia > tolerancia ? diferencia : 0
    };
}

/**
 * Metodo auxiliar para calcular los días base de un colaborador en un período específico, considerando su fecha de inicio y cese.
 * @param emp - El colaborador para el cual se calcularán los días base.
 * @param periodo - El objeto que contiene el año, mes y rango de fechas del período a procesar.
 * @returns - La cantidad de días base que corresponden al colaborador en el período especificado, considerando su fecha de inicio y cese.
 * @throws - No lanza excepciones, pero devuelve 0 si el colaborador ingresó después del fin del mes o cesó antes de iniciar el mes.
 * Este método se utiliza para determinar la cantidad de días computables para el cálculo de incidencias de asistencia, 
 * ajustando el rango de días según la fecha de inicio y cese del colaborador.
 */
export function calcularDiasBase(emp: any, periodo: ReturnType<typeof obtenerPeriodo>): number {
    const inicioMes = periodo.fechaInicioMes;
    const finMes = periodo.fechaFinMes;

    // Si ingresó después del fin del mes analizado, no le corresponde sueldo
    if (emp.fecha_inicio && new Date(emp.fecha_inicio) > finMes) return 0;
    // Si cesó antes de iniciar este mes, tampoco le corresponde
    if (emp.fecha_cese && new Date(emp.fecha_cese) < inicioMes) return 0;

    let diaInicio = 1;
    let diaFin = 30; //Base 30 comercial

    if (emp.fecha_inicio && new Date(emp.fecha_inicio) > inicioMes) 
        diaInicio = new Date(emp.fecha_inicio).getUTCDate();
    

    if (emp.fecha_cese && new Date(emp.fecha_cese) < finMes) 
        diaFin = Math.min(30, new Date(emp.fecha_cese).getUTCDate());
    

    return Math.max(0, diaFin - diaInicio + 1);
}