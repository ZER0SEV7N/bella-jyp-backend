//src/modules/payroll/planillas/use-case/generarPlanilla.useCase.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { guardarHistorialPlanilla, ingresosCobrado, obtenerAdelantosAprobados, obtenerIncidenciaAprobada, obtenerMesesCombradosSemestre, obtenerParametrosLegalesPlanillas, traerDatosEmpleado, traerFinancierosEmpleado} from '../helpers/empleados.helper';
import { calculoPlanilla } from '../helpers/calculo_planillas.helper';
import { generateBoletaPdf, EmpresaData, CabezalEmpleado, IngresosEmpleado, DescuentosEmpleado, AportacionesEmpleado, AportesEmpleador, TotalesPlanilla, PeriodoPlanilla} from '../helpers/generarBoleta.helper';

/**
 * Caso de uso para generar la planilla de un empleado.
 * Este caso de uso realiza los siguientes pasos:
 * 1. Obtiene los datos del empleado y sus datos financieros.
 * 2. Valida que el empleado tenga incidencia aprobada para el periodo actual.
 * 3. Calcula los ingresos, descuentos y aportaciones del empleado.
 * 4. Guarda el historial de la planilla en la base de datos.
 * 5. Genera un PDF de la boleta de pago del empleado.
 * 6. Retorna la ruta del archivo PDF generado y el ID de la planilla guardada.
 */
@Injectable()
export class GenerarPlanillaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Metodo de ejecución del caso de uso para generar la planilla de un empleado.
   * Este método realiza la generación de la planilla y la boleta de pago del empleado para el periodo actual.
   * @param idEmpleado - El ID del empleado para el cual se generará la planilla.
   * @returns - Un objeto que contiene un mensaje de éxito, la ruta del archivo PDF generado y el ID de la planilla guardada.
   * @throws NotFoundException si el empleado no tiene datos financieros o no hay incidencia aprobada para el periodo actual.
   */
  async execute(idEmpleado: string) {
    const periodo = ServerTime.obtenerPeriodoActual;
    const { inicioMes, finMes } = ServerTime.obtenerRangoMesActual;

    //Validar si el mes es julio o diciembre para determinar si se debe calcular gratificación
    const mes = Number(periodo.slice(5, 7));
    const esMesGratificacion = mes === 7 || mes === 12;

    // ---------- Obtener datos del empleado y sus finanzas ----------
    const [ empleado, datosFinanciero, incidencia, adelantos, parametros, acumulados, mesesTrabajados ] = await Promise.all([
      traerDatosEmpleado(this.prisma, idEmpleado),
      traerFinancierosEmpleado(this.prisma, idEmpleado),
      obtenerIncidenciaAprobada(this.prisma, idEmpleado, periodo),
      obtenerAdelantosAprobados(this.prisma, idEmpleado, inicioMes, finMes),
      obtenerParametrosLegalesPlanillas(this.prisma),
      ingresosCobrado(this.prisma, idEmpleado),
      esMesGratificacion ? obtenerMesesCombradosSemestre(this.prisma, idEmpleado) : Promise.resolve(0),
    ]);

    // ---------- Validaciones ----------
    if (!datosFinanciero) throw new NotFoundException('El empleado no tiene datos financieros');
    if (!incidencia) throw new NotFoundException(`No hay incidencia aprobada para el periodo ${periodo}`);
    if (!empleado.jornada) throw new BadRequestException('El empleado no tiene jornada asignada');

    //Calcular la cantidad de días laborables en la jornada del empleado para el periodo actual
    const horario = empleado.jornada.horario_semanal;
    if (!Array.isArray(horario)) throw new BadRequestException('El horario semanal de la jornada es inválido');

    const diasLaborales = (horario as unknown as { laborable: boolean }[]).filter((d) => d.laborable).length;
    if (diasLaborales === 0) throw new BadRequestException('La jornada no tiene días laborables');

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
      acumulados
    );

    const planilla_guardada = await guardarHistorialPlanilla(
      this.prisma,
      empleado.id,
      periodo,
      calculos
    );

    // ---------- Datos separados por categoría ----------
    const empresaInfo: EmpresaData = {
      nombreEmpresa: 'J&P PERIFERICOS S.A.C.',
      ruc: null,
      direccion: null
    };

    const cabezal: CabezalEmpleado = {
      nombre_completo: `${empleado.nombre} ${empleado.apellido}`,
      nro_documento: empleado.nro_documento,
      cargo: empleado.cargo.nombre,
      area: empleado.area.nombre,
      asignacion_familiar: empleado.asig_familiar,
      dias_laborados: planilla_guardada.dias_laborados,
      regimen_pension: datosFinanciero.regimen_pension.nombre
    };

    const ingresos: IngresosEmpleado = {
      sueldo_base: planilla_guardada.sueldo_base,
      asignacion_familia: planilla_guardada.asignacion_familia,
      horas_extras_25: planilla_guardada.horas_extras_25,
      horas_extras_35: planilla_guardada.horas_extras_35,
      recargo_nocturno: planilla_guardada.recargo_nocturno,
      gratificacion: planilla_guardada.gratificacion,
      bonif_extraordinaria: planilla_guardada.bonif_extraordinaria,
    };

    const descuentos: DescuentosEmpleado = {
      descuento_faltas: planilla_guardada.descuento_faltas,
      descuento_tardanzas: planilla_guardada.descuento_tardanzas,
      descuento_quinta: planilla_guardada.descuento_quinta,
      descuento_adelanto: planilla_guardada.descuento_adelanto,
      descuento_eps: planilla_guardada.descuento_eps,
    };

    const aportaciones: AportacionesEmpleado = {
      descuento_onp: planilla_guardada.descuento_onp,
      descuento_afp_fondo: planilla_guardada.descuento_afp_fondo,
      descuento_afp_seguro: planilla_guardada.descuento_afp_seguro,
      descuento_afp_comision: planilla_guardada.descuento_afp_comision,
      tasa_afp_aplicada: planilla_guardada.tasa_afp_aplicada,
    };

    const aportesEmpleador: AportesEmpleador = {
      aporte_essalud: planilla_guardada.aporte_essalud,
      aporte_vida_ley: planilla_guardada.aporte_vida_ley,
    };

    const totales: TotalesPlanilla = {
      total_ingresos: planilla_guardada.total_ingresos,
      total_descuentos: planilla_guardada.total_descuentos,
      neto_a_pagar: planilla_guardada.neto_a_pagar,
    };

    const periodoData: PeriodoPlanilla = {
      periodo,
    };

    // ---------- Generar PDF ----------
    const outputPath = path.join(
      process.cwd(),
      'storage',
      'boletas',
      `${periodo}_${empleado.nro_documento}.pdf`,
    );

    const filePath = await generateBoletaPdf(
      empresaInfo,
      cabezal,
      ingresos,
      descuentos,
      aportaciones,
      aportesEmpleador,
      totales,
      periodoData,
      outputPath,
    );

    return {
      message: 'Boleta generada correctamente',
      filePath,
      planillaId: planilla_guardada.id,
    };
  }
}