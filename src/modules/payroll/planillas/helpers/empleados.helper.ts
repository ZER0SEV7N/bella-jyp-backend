//src/modules/payroll/planillas/helpers/empleados.helper.ts
import { PrismaService } from "@/common/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";
import { ServerTime } from "@/common/utils/server-time";

/**
 * 
 * @param prisma 
 * @param idEmpleado 
 * @returns 
 */
export async function traerDatosEmpleado(prisma: PrismaService, idEmpleado: string) {
    const empleado = await prisma.empleados.findUnique({
        where: {
            id: idEmpleado,
            activo: true,
            deleted_at: null,
        },
        select: {
            nro_documento: true,
            cargo: true,
            nombre: true,
            apellido: true,
            afp_fecha_filiacion: true,
            fecha_inicio: true,
            asig_familiar: true,
            estado_laboral: true,
            area: {
                select: {
                nombre: true,
                },
            },
            jornada: {
                select: {
                duracion: true,
                modalidad: true,
                total_horas_semana: true
                }
            }
        }
    });
    if (!empleado) throw new NotFoundException("Empleado no encontrado o inactivo");

    return empleado;
}


//obtener incidencias del empelado, mediante id, las incidencias debe estar mediante el mes
function obtener_incidencias(prisma: PrismaService, idEmpleado: string){   
    return prisma.incidencias_mes.findFirst({
        where:{
            empleado_id: idEmpleado,
            periodo: ServerTime.obtenerPeriodoActual,
            estado: "APROBADO",
        },
        select:{
            dias_trabajados:true,
            faltas:true,
            minutos_tardanza:true,
            horas_extras_25:true,
            horas_extras_35:true
        }
    });
}

//obtener datos financiero de empleado, obtner datos financieros de empleados
export async function getDatosFinancierosEmpleado(prisma: PrismaService, empleadoId: string) {
    return await prisma.dato_financiero.findUnique({
        where: {empleado_id: empleadoId},
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
                    comisiones_afp: {
                        select: {
                            aporte_obligatorio: true,
                            comision_sobre_ra: true,
                            prima_seguro: true,
                            comision_mixta: true
                        },
                    },
                },
            },
        }
    });
}