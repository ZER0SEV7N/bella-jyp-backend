import { PrismaService } from "@/common/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";
import { ServerTime } from "@/common/utils/server-time";
import { IdentityGenerator } from "@/common/utils/uuid.util";

export async function traerDatosEmpleado( prisma: PrismaService, idEmpleado:string){
    const empleado = prisma.empleados.findUnique({
        where :{
            id: idEmpleado,
            activo:true,
            deleted_at: null
        },
        select:{
            nro_documento: true,
            cargo:true,
            nombre: true,
            apellido: true,
            afp_fecha_filiacion:true,
            fecha_inicio:true,
            asig_familiar: true,
            estado_empleado:{
                select:{
                    descripcion:true,
                }
            },
            area:{
                select:{
                    nombre: true,
                }
            },
            jornada:{
                select:{
                    duracion: true,
                    modalidad:true,
                    total_horas_semana: true, 
                }
            },
        }
    });
    
    if (!empleado) {
        throw new NotFoundException("Emepleado no encontrado o incativo");
    }

    return empleado;
}

//obtener incidencias del empelado, mediante id, las incidencias debe estar mediante el mes
function obtener_incidencias(prisma: PrismaService, idEmpleado: string){   
    return prisma.incidencias_mes.findFirst({
        where:{
            id: idEmpleado,
            periodo: ServerTime.obtenerPeriodoActual,
            estado: "APROBADO",
        },
        select:{
            dias_trabajados:true,
            faltas:true,
            minutos_tardanza:true,
            horas_extras_25:true,
            horas_extras_35:true,        
        }
    });
}

//obtener datos financiero de empleado, obtner datos financieros de empleados
export async function getDatosFinancierosEmpleado(
  prisma: PrismaService,
  empleadoId: string
) {
  return await prisma.dato_financiero.findUnique({
    where: {
      empleado_id: empleadoId,
    },
    select: {
      // 1. Datos de la EPS
      regimen_salud: true,
      eps_nombre: true,
      eps_plan: true,
      eps_costo_adicional: true,

      // 2. Cuentas Bancarias del Empleado (Sueldo)
      tipo_cuenta_sueldo: true,
      nro_cuenta_sueldo: true,
      cci_sueldo: true,
      banco_sueldo: {
        select: {
          id: true,
          nombre: true,
        },
      },

      // 2. Cuentas Bancarias del Empleado (CTS)
      tipo_cuenta_cts: true,
      nro_cuenta_cts: true,
      cci_cts: true,
      banco_cts: {
        select: {
          id: true,
          nombre: true,
        },
      },

      // 3. AFP y sus Aportaciones con Cantidad
      tipo_afp: {
        select: {
          id: true,
          nombre: true,
          aportaciones: {
            select: {
              id: true,
              nombre: true,
              cantidad: true, // Porcentaje o valor asignado
            },
          },
        },
      },
    },
  });
}
//Crear funcion de parametros legales
export async function guardarHistoriaPlanillas(prisma: PrismaService,emp: any, datosPlanillas: any){
    //traer los datos para histroial
    const {
    sueldo_base = 0,
    asignacion_familia = 0,
    horas_extras_25 = 0,
    horas_extras_35 = 0,
    recargo_nocturno = 0,
    descuento_afp_fondo = 0,
    descuento_afp_seguro = 0,
    descuento_afp_comision = 0,
    descuento_quinta = 0,
    tasa_afp_aplicada = 0,
    aporte_essalud = 0,
    total_ingresos = 0,
    total_descuentos = 0,
    neto_a_pagar = 0,
    } = datosPlanillas;

  prisma.historial_planillas.create({
    data:{
        id: IdentityGenerator.generateId(),
        empleado_id: emp.id,
        periodo: ServerTime.obtenerPeriodoActual,
        estado:'ABIERTO',
        sueldo_base,
        asignacion_familia,
        horas_extras_25,
        horas_extras_35,
        recargo_nocturno,
        descuento_afp_fondo,
        descuento_afp_seguro,
        descuento_afp_comision,
        descuento_quinta,
        tasa_afp_aplicada,
        aporte_essalud,
        total_ingresos,
        total_descuentos,
        neto_a_pagar,
    }
  })
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
