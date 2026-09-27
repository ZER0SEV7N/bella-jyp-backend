import { PrismaService } from "@/common/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";

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
            fecha_inicio:true,
            asig_familiar: true,
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
            incidencias:{
                where:{
                    creado_en:{

                    }
                },
                select:{
                    faltas:true,
                    dias_trabajados:true,
                    horas_extras_25: true,
                    horas_extras_35: true,
                    periodo:true,
                }
            },
            dato_financiero:{
                select:{
                    sueldo_basico: true,
                    tipo_comision: true,
                    regimen_salud: true,
                    regimen_pension:{
                        select:{
                            tipo_afp:{
                                
                            }
                        }
                    },
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
function obtener_incidencias(prisma: PrismaService, idEmpleado: string, fecha: Date){
    return prisma.incidencias_mes.findFirst({
        where:{
            id: idEmpleado,
        },
        select:{

        }
    });
}
//obtener datos financiero de empleado, obtner datos financieros de empleados
function datos_financiero(prisma: PrismaService, idEmpleado: string){
    return prisma.dato_financiero.findFirst({

    });
}
//obtener cantidad de habientes, la cantidad de familiares que tiene el empleado
function derechos_habientes(prisma: PrismaService, idEmpleado: string){
    return prisma.derechohabiente_documentos.count({

    });
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
