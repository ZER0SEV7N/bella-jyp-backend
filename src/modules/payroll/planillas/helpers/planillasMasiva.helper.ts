import { PrismaService } from "@/common/prisma/prisma.service";
import { ServerTime } from "@/common/utils/server-time";
import { Decimal } from "@prisma/client/runtime/client";

//taer empleados
export async function traerEmpleadosArea (prisma: PrismaService,idArea: string, Cantiadadlote = 50) {
    //incializar le contador
    const resultado : any[] = [];
    let ultimoID : string | null = null;
    let hayMas: boolean = true;  
    
    while(hayMas){
        //armar la query de datos de empleado
        const loteEmpleados = await prisma.empleados.findMany({
            where: {
                activo: true,
                area_id: idArea,
                fecha_cese: null,
                deleted_at: null,
            },
            take: Cantiadadlote + 1,
            skip: ultimoID ? 1: 0,
            cursor: ultimoID ? { id: ultimoID } : undefined,
            orderBy:{ id:'asc'}, 
            select:{
                id: true,
                asig_familiar: true,
                jornada:{
                    select:{
                        total_horas_semana: true,
                        horario_semanal:true,
                    },
                },
                dato_financiero:{
                    select:{
                        sueldo_basico: true,
                        cuspp: true,
                        tipo_comision: true,
                        regimen_salud: true,
                        eps_nombre: true,
                        eps_plan: true,
                        eps_costo_adicional:true,
                        tipo_cuenta_sueldo: true, nro_cuenta_sueldo: true, cci_sueldo: true,
                        regimen_pension:{
                            select:{
                                nombre:true,
                            }
                        },
                        tipo_afp:{
                            select:{
                                id:true,
                                nombre:true,
                                comisiones_afp:{
                                   where:{periodo_final:null},
                                   take:1,
                                   select:{
                                     afp_id:true,
                                     aporte_obligatorio:true,
                                     comision_sobre_ra:true,
                                     prima_seguro:true,
                                     comision_mixta:true,
                                   } 
                                }
                            }
                        }
                    }
                },
            }
        });
        if (loteEmpleados.length === 0) break;

        hayMas = loteEmpleados.length> Cantiadadlote
        const empleados = hayMas? loteEmpleados.slice(0, Cantiadadlote): loteEmpleados;
        const ids = empleados.map((emp) => emp.id );
        const [ MontoAdelanto, MesesTrabajadosDelSemestre, ingresosPreviosEmpleado, incidencias ] = await Promise.all([
            extraerAdelantosPorEmpleado(prisma, ids),
            obtenerMesesCobradosSemestre(prisma,ids),
            ingresosPrevios(prisma, ids),          
            incidenciasEmpleados(prisma, ids)
        ]); 
        //incio de mapeao de datos
        for(const empleado of empleados){
            const acum = ingresosPreviosEmpleado.get(empleado.id);
            resultado.push({
                ...empleado,
                montoAdelanto: MontoAdelanto.get(empleado.id)?? new Decimal(0),
                mesesTrabajdos: MesesTrabajadosDelSemestre.get(empleado.id)?? 0,
                ingresosPrevios: acum?.ingresosPrevios ?? new Decimal(0),
                retencionesPrevias: acum.descuentoQuinta ?? new Decimal(0),
                incidencias: incidencias.get(empleado.id) ?? null,
            })
        }
        ultimoID = empleados[empleados.length -1].id;
    }
    return resultado;
}
//traer todos los adelantos delos empleados
async function extraerAdelantosPorEmpleado(prisma:PrismaService, ids: string[]) {
    const { inicioMes ,finMes} = ServerTime.obtenerRangoMesAcutal
    const adelantos = await prisma.solicitud.groupBy({
        by: ['empleado_id'],
        where : {
            empleado_id:{
                in: ids,
            },
            tipo:'ADELANTO_SUELDO',
            estado:'APROBADA',
            created_at:{
                gte:inicioMes ,
                lte: finMes,
            }        
        },
        _sum:{
            monto:true,
        }
    });
    //mapear los valores del mapping
    const mapaAdelantos = new Map<string, Decimal>();
    for(const adelanto of adelantos){
        const TOTAL_MONTO = adelanto._sum.monto ?? new Decimal(0);
        mapaAdelantos.set(adelanto.empleado_id,TOTAL_MONTO);
    }

    return mapaAdelantos;
}

//obntenr canitdad de meses que el empleado trabajdo para el calculo de la gratificacion
async function obtenerMesesCobradosSemestre(prisma:PrismaService, ids:string[]) {
    const { desde, hasta } = obtenerRangoSemestre();
    const mesesCobrados = await prisma.historial_planillas.groupBy({
        by:['empleado_id'],
        where:{
            empleado_id:{
                in: ids,
            },
            periodo:{
                gte: desde,
                lte: hasta,
            },
            estado:{
                in: ['CONGELADO','ABIERTO']
            },
            activo:true
        },
        _count:{
            _all: true,
        },
        
    });
    const mesesCobradosMap = new Map<string, number>();
    for(const item of mesesCobrados) {
        mesesCobradosMap.set(item.empleado_id, item._count._all ?? 0);
    }
    return mesesCobradosMap;
}

//funcion para el ingresos previos para su posterior uso para quitan Categoria
async function ingresosPrevios(prisma: PrismaService, ids: string[]) {
    //extraer ingresos y decunetos agrupados por ids de empleados
    const ingresosCobrados =  await prisma.historial_planillas.groupBy({
        by:['empleado_id'],
        where:{
            empleado_id:{
                in: ids,
            },
            periodo:{
                gte:`${ServerTime.obtenerYearActual}-01`,
                lt: ServerTime.obtenerPeriodoActual,
            },
        },
        _sum:{
            total_ingresos:true, 
            descuento_quinta:true,
        }
    });
    const ingresos = new Map<string, {ingresosPrevios: Decimal, descuentoQuinta:Decimal}>();
    for( const item of ingresosCobrados){
        ingresos.set(item.empleado_id, {
            ingresosPrevios: item._sum.total_ingresos ?? new Decimal(0),
             descuentoQuinta:item._sum.descuento_quinta ?? new Decimal(0),
            });
    }
    return ingresos;
}
async function incidenciasEmpleados(prisma:PrismaService, ids: string[]) {
    const incidenciasEmpleado =  await prisma.incidencias_mes.findMany({
        where:{
            empleado_id:{
                in: ids,
            },
            estado:'APROBADO',
            periodo: ServerTime.obtenerPeriodoActual
        },
        select: { empleado_id:true ,dias_trabajados: true, faltas: true, minutos_tardanza: true, horas_extras_25: true, horas_extras_35: true },
    });
    const incidenciasMap = new Map<string, any>();
    for(const inc of  incidenciasEmpleado){
        incidenciasMap.set(inc.empleado_id, {
            faltas: inc.faltas,
            minutos_tardanza: inc.minutos_tardanza,
            dias_trabajados: inc.dias_trabajados,
            horas_extras_25: inc.horas_extras_25.toString(),
            horas_extras_35: inc.horas_extras_35.toString(),
        })
    }
    return incidenciasMap;
}

function obtenerRangoSemestre(){
  const mesAcutal = ServerTime.obtenerMesActual;
  return  mesAcutal <= 7 ? {
    desde: `${ServerTime.obtenerYearActual}-01`,
    hasta: `${ServerTime.obtenerYearActual}-06`
  } : 
  {
    desde: `${ServerTime.obtenerYearActual}-07`,
    hasta:`${ServerTime.obtenerYearActual}-12`
  } 
}

