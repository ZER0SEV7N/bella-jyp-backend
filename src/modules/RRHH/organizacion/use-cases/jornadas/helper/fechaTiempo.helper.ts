//src/modules/RRHH/organizacion/use-cases/jornadas/helper/fechaTiempo.helper.ts
import { DiaHorarioDto } from "@jyp/shared-contracts";

/**
 * Funcion auxiliar para calcular el total de horas trabajadas en un día específico de la jornada laboral.
 * @param dia - Objeto que representa un día de la semana con sus horarios de entrada, salida y descanso.
 * @returns El total de horas trabajadas en ese día, 
 * considerando los horarios de entrada, salida y descanso. Si el día no es laborable o no se especifican los horarios, retorna 0.
 * @throws Error si los horarios de entrada, salida o descanso no están en el formato correcto "HH:mm".
 */
export function calcularHorasDia(dia: DiaHorarioDto): number {
  if (!dia.laborable || !dia.entrada || !dia.salida) return 0;

  //Validar formato de hora
  const [hEnt, mEnt] = dia.entrada.split(':').map(Number);
  const [hSal, mSal] = dia.salida.split(':').map(Number);

  let minutosTotales = (hSal * 60 + mSal) - (hEnt * 60 + mEnt);
  if (minutosTotales <= 0) minutosTotales += 24 * 60; //Salida al día siguiente

  //Descontar descanso si fue especificado
  if (dia.inicio_descanso && dia.fin_descanso) {
    //Validar formato de hora
    const [hDescIni, mDescIni] = dia.inicio_descanso.split(':').map(Number);
    const [hDescFin, mDescFin] = dia.fin_descanso.split(':').map(Number);
    let descansoMinutos = (hDescFin * 60 + mDescFin) - (hDescIni * 60 + mDescIni);
    if (descansoMinutos <= 0) descansoMinutos += 24 * 60;
    minutosTotales -= descansoMinutos;
  }

  return Math.max(0, Number((minutosTotales / 60).toFixed(2)));
}