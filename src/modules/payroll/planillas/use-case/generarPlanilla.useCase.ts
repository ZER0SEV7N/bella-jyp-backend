import { PrismaService } from "@/common/prisma/prisma.service";
import { ServerTime } from "@/common/utils/server-time";
import { obtenerAdelantosAprobados, obtenerIncidenciaAprobada, obtenerMesesSemestre, obtenerParametrosLegalesPlanillas, traerDatosEmpleado, traerFinancierosEmpleado } from "../helpers/empleados.helper";
import { calculoPlanilla } from "../helpers/calculo_planillas.helper";


export class GenerarPlanillaUseCase {
    constructor(private readonly prisma: PrismaService) {}
    async execute(idEmepleado:string) {
        
        //obtener los datos necesarios mediante el helpers
        const [datosEmpleado,datosFinanciero,incidencia,adelantados,parametrosLegales, mesesTrabajados] = await Promise.all([
            traerDatosEmpleado(this.prisma, idEmepleado),
            traerFinancierosEmpleado(this.prisma, idEmepleado),
            obtenerIncidenciaAprobada(this.prisma, idEmepleado, ServerTime.obtenerPeriodoActual),
            obtenerAdelantosAprobados(this.prisma, idEmepleado, ServerTime.obtenerRangoMesAcutal.inicioMes, ServerTime.obtenerRangoMesAcutal.finMes),
            obtenerParametrosLegalesPlanillas(this.prisma),
            obtenerMesesSemestre(this.prisma, idEmepleado),
        ]);
        //realizar calculo de planillas
        const calculos = await calculoPlanilla(datosEmpleado.jornada.total_horas_semana,mesesTrabajados,datosEmpleado.asig_familiar,datosFinanciero,incidencia,adelantados,parametrosLegales); 

    }
}