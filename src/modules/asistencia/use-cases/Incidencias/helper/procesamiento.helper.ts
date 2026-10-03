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
 * Función para obtener el período en formato de año y mes, así como las fechas de inicio y fin del mes.
 * Para la lógica de cálculo de días, se considera una base de 30 días comerciales.
 * @param periodo - String en formato "YYYY-MM" que representa el período a evaluar.
 * @returns - Un objeto que contiene el año, mes, fecha de inicio del mes, fecha de fin del mes y la cantidad de días del mes.
 * @throws - Lanza un error si el formato del período es inválido.
 */
export function obtenerPeriodo(periodo: string) {
  //Validación básica del formato "YYYY-MM"
  const [year, month] = periodo.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) throw new Error('Formato de período inválido. Debe ser "YYYY-MM".');

  //Cálculo de fechas de inicio y fin del mes en UTC
  const fechaInicioMes = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const fechaFinMes = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  //Retorno del objeto con la información del período
  return { year, month, fechaInicioMes, fechaFinMes, diasDelMes: fechaFinMes.getUTCDate() };
}

/**
 * Función para obtener los colaboradores activos según los filtros proporcionados en el DTO y el período especificado.
 * @param prisma - Instancia del servicio Prisma para interactuar con la base de datos.
 * @param dto - DTO que contiene los filtros opcionales para empleados y áreas.
 * @Dto: {
 *   empleado_id?: string;
 *   area_id?: string;
 *   
 * }
 * @param periodo - El objeto que contiene la información del período, incluyendo las fechas de inicio y fin del mes.
 * @returns - Una promesa que resuelve con un array de empleados activos que cumplen con los criterios especificados.
 * @throws - Lanza un error si ocurre algún problema al consultar la base de datos.
 */
export async function obtenerColaboradores(prisma: PrismaService, dto: GenerarIncidenciasPeriodoDto, periodo: ReturnType<typeof obtenerPeriodo>) {
  const whereEmpleado: Record<string, any> = { activo: true, deleted_at: null };
  if (dto.empleado_id) whereEmpleado.id = dto.empleado_id;
  if (dto.area_id) whereEmpleado.area_id = dto.area_id;

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
            gte: new Date(periodo.fechaInicioMes.getTime() - 24 * 60 * 60 * 1000),
            lte: new Date(periodo.fechaFinMes.getTime() + 24 * 60 * 60 * 1000)
          }
        }
      }
    }
  });
}

export function indexarMarcacionesPeru(asistencias: any[]) {
  const resultado = new Map<string, { entradas: number[]; salidas: number[] }>();

  asistencias.forEach((a) => {
    const fechaUtc = new Date(a.fecha_hora);
    const fechaPeru = new Date(fechaUtc.getTime() + PERU_TIMEZONE_OFFSET_MINUTES * 60 * 1000);

    const fechaClave = fechaPeru.toISOString().split('T')[0];
    const horaLocalMinutos = fechaPeru.getUTCHours() * 60 + fechaPeru.getUTCMinutes();

    const dia = resultado.get(fechaClave) || { entradas: [], salidas: [] };

    if (a.tipo_marcacion === 'ENTRADA') 
      dia.entradas.push(horaLocalMinutos);
    else if (a.tipo_marcacion === 'SALIDA') 
      dia.salidas.push(horaLocalMinutos);
    

    resultado.set(fechaClave, dia);
  });

  return resultado;
}

// =========================================================================
// SUBFUNCIONES PARA REDUCIR COMPLEJIDAD COGNITIVA (SONARQUBE S3776)
// =========================================================================

function estaEnPeriodoLaboral(emp: any, fecha: Date): boolean {
  if (emp.fecha_inicio && fecha < new Date(emp.fecha_inicio)) return false;
  if (emp.fecha_cese && fecha > new Date(emp.fecha_cese)) return false;
  return true;
}

function tieneSolicitudAprobada(solicitudes: any[], claveFecha: string): boolean {
  return solicitudes.some((s: any) => {
    if (!s.fecha_inicio || !s.fecha_fin) return false;
    const fInicio = new Date(s.fecha_inicio).toISOString().split('T')[0];
    const fFin = new Date(s.fecha_fin).toISOString().split('T')[0];
    return claveFecha >= fInicio && claveFecha <= fFin;
  });
}

function calcularTardanza(entradas: number[], horaEntradaConfig: string, toleranciaMinutos: number): number {
  const [h, m] = horaEntradaConfig.split(':').map(Number);
  const minutosProgramados = h * 60 + m;

  const primeraEntrada = Math.min(...entradas);
  const diferencia = primeraEntrada - minutosProgramados;

  return diferencia > toleranciaMinutos ? diferencia : 0;
}

function calcularSobretiempo(salidas: number[], horaSalidaConfig?: string | null): { he25: number; he35: number } {
  if (!horaSalidaConfig || salidas.length === 0) return { he25: 0, he35: 0 };
  

  const [h, m] = horaSalidaConfig.split(':').map(Number);
  const minutosProgramados = h * 60 + m;

  const ultimaSalida = Math.max(...salidas);
  const excesoMinutos = ultimaSalida - minutosProgramados;

  // Umbral mínimo de 15 minutos para registrar sobretiempo efectivo
  if (excesoMinutos < 15) return { he25: 0, he35: 0 };
  

  const horasTotales = excesoMinutos / 60;
  if (horasTotales <= 2) return { he25: Number(horasTotales.toFixed(2)), he35: 0 };
  

  return {
    he25: 2.0,
    he35: Number((horasTotales - 2).toFixed(2)),
  };
}

/**
 * Evalúa el día coordinando subfunciones aisladas (Complejidad cognitiva reducida a < 4)
 */
export function evaluarDia(emp: any, dia: number, periodo: ReturnType<typeof obtenerPeriodo>, horario: DiaHorario[], marcaciones: ReturnType<typeof indexarMarcacionesPeru>) {
  const fecha = new Date(Date.UTC(periodo.year, periodo.month - 1, dia));
  const claveFecha = fecha.toISOString().split('T')[0];

  if (!estaEnPeriodoLaboral(emp, fecha)) return { falta: 0, tardanza: 0, he25: 0, he35: 0 };
  

  const config = horario.find((h) => h.dia.toUpperCase() === DIAS_MAP[fecha.getUTCDay()]);
  if (!config?.laborable || !config.entrada) return { falta: 0, tardanza: 0, he25: 0, he35: 0 };
  
  if (tieneSolicitudAprobada(emp.solicitudes, claveFecha)) return { falta: 0, tardanza: 0, he25: 0, he35: 0 };
  

  const marcasDelDia = marcaciones.get(claveFecha) || { entradas: [], salidas: [] };

  if (marcasDelDia.entradas.length === 0) return { falta: 1, tardanza: 0, he25: 0, he35: 0 };
  

  const tolerancia = emp.jornada?.tolerancia_minutos ?? 5;
  const tardanza = calcularTardanza(marcasDelDia.entradas, config.entrada, tolerancia);
  const { he25, he35 } = calcularSobretiempo(marcasDelDia.salidas, config.salida);

  return { falta: 0, tardanza, he25, he35 };
}

export function calcularDiasBase(emp: any, periodo: ReturnType<typeof obtenerPeriodo>): number {
  const inicioMes = periodo.fechaInicioMes;
  const finMes = periodo.fechaFinMes;

  if (emp.fecha_inicio && new Date(emp.fecha_inicio) > finMes) return 0;
  if (emp.fecha_cese && new Date(emp.fecha_cese) < inicioMes) return 0;

  let diaInicio = 1;
  let diaFin = 30; // Base 30 comercial

  if (emp.fecha_inicio && new Date(emp.fecha_inicio) > inicioMes) diaInicio = new Date(emp.fecha_inicio).getUTCDate();
  

  if (emp.fecha_cese && new Date(emp.fecha_cese) < finMes) diaFin = Math.min(30, new Date(emp.fecha_cese).getUTCDate());

  return Math.max(0, diaFin - diaInicio + 1);
}

export async function procesarColaborador(prisma: PrismaService, emp: any, periodoTexto: string, periodo: ReturnType<typeof obtenerPeriodo>) {
  const horario: DiaHorario[] = Array.isArray(emp.jornada?.horario_semanal) ? emp.jornada.horario_semanal : [];

  const marcaciones = indexarMarcacionesPeru(emp.asistencias);

  let faltas = 0;
  let tardanza = 0;
  let horasExtras25 = 0;
  let horasExtras35 = 0;

  for (let dia = 1; dia <= periodo.diasDelMes; dia++) {
    const resultado = evaluarDia(emp, dia, periodo, horario, marcaciones);
    faltas += resultado.falta;
    tardanza += resultado.tardanza;
    horasExtras25 += resultado.he25;
    horasExtras35 += resultado.he35;
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
      horas_extras_25: horasExtras25,
      horas_extras_35: horasExtras35,
      estado: 'PENDIENTE'
    },
    update: {
      dias_trabajados: diasComputables,
      faltas,
      minutos_tardanza: tardanza,
      horas_extras_25: horasExtras25,
      horas_extras_35: horasExtras35,
      estado: 'PENDIENTE'
    }
  });

  return {
    empleado_id: emp.id,
    nombre_completo: `${emp.nombre ?? ''} ${emp.apellido ?? ''}`.trim(),
    nro_documento: emp.nro_documento,
    periodo: periodoTexto,
    dias_computables: diasComputables,
    faltas,
    minutos_tardanza: tardanza,
    horas_extras_25: horasExtras25,
    horas_extras_35: horasExtras35,
  };
}