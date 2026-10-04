import { PrismaService } from "@/common/prisma/prisma.service";
import { ServerTime } from "@/common/utils/server-time";
import { IdentityGenerator } from "@/common/utils/uuid.util";
import { ConflictException, NotFoundException } from "@nestjs/common";
const MONTOS_EN_CERO = {
  dias_laborados: 30, sueldo_base: 0, asignacion_familia: 0, horas_extras_25: 0, horas_extras_35: 0,
  recargo_nocturno: 0, gratificacion: 0, bonif_extraordinaria: 0,
  descuento_faltas: 0, descuento_tardanzas: 0,
  descuento_onp: 0, descuento_afp_fondo: 0, descuento_afp_seguro: 0, descuento_afp_comision: 0,
  descuento_quinta: 0, descuento_adelanto: 0, descuento_eps: 0,
  aporte_essalud: 0, total_ingresos: 0, total_descuentos: 0, neto_a_pagar: 0,
};

export async function traerDatosEmpleado(prisma: PrismaService, idEmpleado: string) {
  const empleado = await prisma.empleados.findUnique({
    where: { id: idEmpleado, activo: true, deleted_at: null },
    select: {
      id: true,
      nro_documento: true,
      nombre: true,
      apellido: true,
      estado_laboral: true,
      afp_fecha_filiacion: true,
      fecha_inicio: true,
      fecha_cese: true,
      asig_familiar: true,
      cargo: { select: { nombre: true } },
      area: { select: { nombre: true } },
      jornada:{
        select:{
          total_horas_semana:true,
        }
      }
    },
  });
  if (!empleado) throw new NotFoundException('Empleado no encontrado o inactivo');
  return empleado;
}

export async function obtenerIncidenciaAprobada(prisma: PrismaService, empleadoId: string, periodo: string) {
  return await prisma.incidencias_mes.findFirst({
    where: { empleado_id:empleadoId, periodo:periodo , estado: 'APROBADO' },
    select: { dias_trabajados: true, faltas: true, minutos_tardanza: true, horas_extras_25: true, horas_extras_35: true },
  });
}

export async function obtenerAdelantosAprobados(prisma: PrismaService, empleadoId: string, inicioMes: Date, finMes: Date) {
  const resultado = await prisma.solicitud.aggregate({
    _count:{
      id:true
    },
    _sum:{
        monto:true
    },
    where:{
      empleado_id:empleadoId,
      tipo:"ADELANTO_SUELDO",
      estado:'APROBADA',
      created_at:{
        gte:inicioMes,
        lte:finMes
      },
    },
  })
  return{
    totalSolicitudes: resultado._count.id,
    totalMonto: resultado._sum.monto || 0
  }
}

export async function traerFinancierosEmpleado(prisma: PrismaService, empleadoId: string) {
  return await prisma.dato_financiero.findUnique({
    where: { empleado_id: empleadoId, deleted_at: null },
    select: {
      sueldo_basico: true,
      cuspp: true,
      tipo_comision: true,
      regimen_pension: { select: { id: true, nombre: true } },
      regimen_salud: true,
      eps_nombre: true,
      eps_plan: true,
      eps_costo_adicional: true,
      tipo_cuenta_sueldo: true, nro_cuenta_sueldo: true, cci_sueldo: true,
      banco_sueldo: { select: { id: true, nombre: true } },
      tipo_cuenta_cts: true, nro_cuenta_cts: true, cci_cts: true,
      banco_cts: { select: { id: true, nombre: true } },
      tipo_afp: {
        select: {
          id: true,
          nombre: true,
          comisiones_afp: {
            where:{
              periodo_final: null,
            },
            orderBy: { periodo_inicio: 'desc' },
            take: 1,
            select: { aporte_obligatorio: true, comision_sobre_ra: true, prima_seguro: true, comision_mixta: true },
          },
        },
      },
    },
  });
}

//obtenecio de parametros legales vigentes necesarios para el calculo de planillas
const PARAMETROS_PLANILLA = ['RMV', 'UIT', 'ESSALUD_TCP', 'DIVISOR_HORAS_MES', 'PRO_VIDA'] as const;
type Parametro = (typeof PARAMETROS_PLANILLA)[number];
export async function obtenerParametrosLegalesPlanillas(prisma: PrismaService) {
  const parametros = await prisma.parametro_legal.findMany({
    where: {
      codigo: { in: [...PARAMETROS_PLANILLA] },
      vigente_hasta: null,
    },
    select: { codigo: true, valor: true },
  });

  const mapeoParametro = Object.fromEntries(
    parametros.map((param) => [param.codigo, Number(param.valor)]),
  ) as Record<Parametro, number>;

  const faltantes = PARAMETROS_PLANILLA.filter((n) => !(n in mapeoParametro));
  if (faltantes.length)
    throw new NotFoundException(`Faltan parámetros legales vigentes: ${faltantes.join(', ')}`);

  return mapeoParametro;
}


//funion de guardar datos en planillas 
export async function guardarHistorialPlanilla(
  prisma: PrismaService, empleadoId: string, periodo: string,
  datos: Partial<typeof MONTOS_EN_CERO> & { tasa_afp_aplicada?: number | null },
) {
  const clave = { empleado_id_periodo: { empleado_id: empleadoId, periodo } };
  const existente = await prisma.historial_planillas.findUnique({ where: clave, select: { estado: true } });
  if (existente && existente.estado !== 'ABIERTO')
    throw new ConflictException(`La planilla ${periodo} ya está ${existente.estado}`);

  const data = { ...MONTOS_EN_CERO, ...datos, tasa_afp_aplicada: datos.tasa_afp_aplicada ?? null };

  return prisma.historial_planillas.upsert({
    where: clave,
    create: { id: IdentityGenerator.generateId(), empleado_id: empleadoId, periodo, estado: 'ABIERTO', ...data },
    update: data,
  });
}
export async function obtenerMesesSemestre(prisma: PrismaService,idEmpleado: string):Promise<number>{
  const peridoGatificacion = obtenerRangoSemestre(); 
  const cantidadMeses = await prisma.historial_planillas.count({
    where:{
      empleado_id: idEmpleado,
      periodo:{ gte:peridoGatificacion.desde , lte: peridoGatificacion.hasta },
      estado: {in : ['CONGELADO', 'ABIERTO']},
      activo:true,
    },
  });
  return cantidadMeses;
}

export function traerEmpleadosArea(prisma: PrismaService, idArea: string, cantidadLote: number){
    const EmpleadoArea = [];
    let ultimoEmpleadoProcesado: string | null = null 
    let registrosCompletos = true;
    while (registrosCompletos) {
        const lote =  prisma.empleados.findMany({
            where:{
                activo: true,   
                area:{
                    id: idArea,
                    activo:true,    
                }
            },
            take:cantidadLote,
            ...( ultimoEmpleadoProcesado && {
                skip: 1,
                cursor:{nro_documento: ultimoEmpleadoProcesado}
            }),
            select:{

            }
        });
    }
}
function obtenerRangoSemestre(){
  const mesAcutal = ServerTime.obtenerMesActual;
  return  mesAcutal <= 6 ? {
    desde: `${ServerTime.obtenerYearActual}-01`,
    hasta: `${ServerTime.obtenerYearActual}-06`
  } : 
  {
    desde: `${ServerTime.obtenerYearActual}-07`,
    hasta:`${ServerTime.obtenerYearActual}-12`
  } 
}

