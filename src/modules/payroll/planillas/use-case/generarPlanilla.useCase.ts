import { PrismaService } from "@/common/prisma/prisma.service";
import { ServerTime } from "@/common/utils/server-time";
import { obtenerAdelantosAprobados, obtenerIncidenciaAprobada, obtenerMesesCombradosSemestre, obtenerParametrosLegalesPlanillas, traerDatosEmpleado, traerFinancierosEmpleado } from "../helpers/empleados.helper";
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
            obtenerMesesCombradosSemestre(this.prisma, idEmepleado),
        ]);
        //calcular los dias laborales
        const daisLaborables = datosEmpleado.jornada.horario_semanal as {laborable: boolean} [];
        //calcular cantidad de dias 
        const dias = daisLaborables.filter((d)=> d.laborable).length;
        //realizar calculo de planillas
        const calculos = await calculoPlanilla(datosEmpleado.jornada.total_horas_semana,mesesTrabajados,dias,datosEmpleado.asig_familiar,datosFinanciero,incidencia,adelantados,parametrosLegales); 

    }
}