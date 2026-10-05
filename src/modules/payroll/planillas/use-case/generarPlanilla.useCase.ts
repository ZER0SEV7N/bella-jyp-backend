import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import { ServerTime } from "@/common/utils/server-time";
import {
    guardarHistorialPlanilla,
    ingresosCobrado,
    obtenerAdelantosAprobados,
    obtenerIncidenciaAprobada,
    obtenerMesesCombradosSemestre,
    obtenerParametrosLegalesPlanillas,
    traerDatosEmpleado,
    traerFinancierosEmpleado,
} from "../helpers/empleados.helper";
import { calculoPlanilla } from "../helpers/calculo_planillas.helper";

@Injectable()
export class GenerarPlanillaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    async execute(idEmpleado: string) {
        // El periodo sale del servidor y se lee una sola vez
        const periodo = ServerTime.obtenerPeriodoActual;
        const { inicioMes, finMes } = ServerTime.obtenerRangoMesAcutal;

        // Los meses del semestre solo importan en julio y diciembre
        const mes = Number(periodo.slice(5, 7));
        const esMesGratificacion = mes === 7 || mes === 12;

        // 1. Datos necesarios, en paralelo
        const [empleado, datosFinanciero, incidencia, adelantos, parametros, acumulados, mesesTrabajados] =
            await Promise.all([
                traerDatosEmpleado(this.prisma, idEmpleado),
                traerFinancierosEmpleado(this.prisma, idEmpleado),
                obtenerIncidenciaAprobada(this.prisma, idEmpleado, periodo),
                obtenerAdelantosAprobados(this.prisma, idEmpleado, inicioMes, finMes),
                obtenerParametrosLegalesPlanillas(this.prisma),
                ingresosCobrado(this.prisma, idEmpleado),
                esMesGratificacion
                    ? obtenerMesesCombradosSemestre(this.prisma, idEmpleado)
                    : Promise.resolve(0),
            ]);

        // 2. Validaciones: estos datos pueden ser null
        if (!datosFinanciero) throw new NotFoundException('El empleado no tiene datos financieros');
        if (!incidencia) throw new NotFoundException(`No hay incidencia aprobada para el periodo ${periodo}`);
        if (!empleado.jornada) throw new BadRequestException('El empleado no tiene jornada asignada');

        // 3. Días laborables por semana (a partir de horario_semanal)
        const horario = empleado.jornada.horario_semanal;
        if (!Array.isArray(horario)) throw new BadRequestException('El horario semanal de la jornada es inválido');

        const diasLaborales = (horario as unknown as { laborable: boolean }[])
            .filter((d) => d.laborable).length;
        if (diasLaborales === 0) throw new BadRequestException('La jornada no tiene días laborables');

        // 4. Cálculo (función síncrona, no lleva await)
        const calculos = calculoPlanilla(
            empleado.jornada.total_horas_semana,
            mesesTrabajados,
            diasLaborales,
            empleado.asig_familiar,
            datosFinanciero,
            incidencia,
            adelantos,
            parametros,
            datosFinanciero.tipo_comision,
            acumulados,
        );

        // 5. Guardar en historial_planillas (upsert; falla si la planilla ya no está ABIERTA)
        return guardarHistorialPlanilla(this.prisma, empleado.id, periodo, calculos);
    }
}