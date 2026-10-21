//src/modules/asistencia/domain/evaluar-marcaciones.ts
import type { DecisionAsistencia, HorarioDia, JornadaHistorica, ResultadoDia, SolicitudAsistencia } from './asistencia.types';
import type { Intervalo } from './intervalos-asistencia';
import { duracion, intervalosTrabajados, minutos, restar } from './intervalos-asistencia';

/**
 * Función que calcula la tardanza en el retorno del refrigerio, considerando los intervalos programados, trabajados y faltantes.
 * @param programado - Arreglo de intervalos que representan el horario programado del trabajador para el día.
 * @param trabajado - Arreglo de intervalos que representan los periodos efectivamente trabajados por el empleado durante el día.
 * @param faltantes - Arreglo de intervalos que representan los periodos faltantes en la asistencia del trabajador, es decir, los periodos en los que no se registraron marcas de entrada o salida.
 * @returns - Número que representa la cantidad de minutos de tardanza en el retorno del refrigerio, calculada a partir de los intervalos programados, trabajados y faltantes.
 * @throws Error si alguno de los parámetros no es válido.
 */
function calcularTardanzaRetorno(programado: Intervalo[], trabajado: Intervalo[], faltantes: Intervalo[]): number {
    //El retorno tardío del refrigerio es tardanza; la tolerancia inicial no se vuelve a aplicar.
    let tardanzaRetorno = 0;
    //Itera sobre los intervalos programados a partir del segundo intervalo (ya que el primero es la entrada inicial) para calcular la tardanza en el retorno del refrigerio.
    for (const [inicio, fin] of programado.slice(1)) {
        const retorno = trabajado.find(([desde, hasta]) => hasta > inicio && desde < fin);
        if (retorno && retorno[0] > inicio)
            tardanzaRetorno += duracion(
                faltantes.flatMap(( [desde, hasta] ) => 
                    hasta <= inicio || desde >= retorno[0] ? [] : [[Math.max(inicio, desde), Math.min(retorno[0], hasta)] as Intervalo] )
            );
    }

    return tardanzaRetorno;
}

/**
 * Función que aplica las decisiones de asistencia relacionadas con el sobretiempo, actualizando el objeto ResultadoDia con los minutos extra observados y las alertas correspondientes.
 * @remarks
 * Esta función verifica si hay minutos extra observados en el objeto ResultadoDia y busca una decisión de asistencia del tipo 'SOBRETIEMPO'.
 * Si no se encuentra una decisión de sobretiempo, se agrega una alerta indicando que el sobretiempo requiere revisión.
 * Si se encuentra una decisión de sobretiempo y la propiedad 'reconocer' es verdadera, se calculan los minutos extra 25 y 35 según los límites establecidos.
 * @param r - Objeto ResultadoDia que contiene la información del día evaluado, incluyendo los minutos extra observados y las alertas.
 * @param decisiones - Arreglo de decisiones de asistencia que pueden incluir decisiones relacionadas con el sobretiempo.
 */
function aplicarSobretiempo(r: ResultadoDia, decisiones: DecisionAsistencia[]): void {
    //Si hay minutos extra observados, se busca una decisión de asistencia del tipo 'SOBRETIEMPO'.
    if (r.minutos_extra_observados > 0) {
        //Si no se encuentra una decisión de sobretiempo, se agrega una alerta indicando que el sobretiempo requiere revisión.
        const sobretiempo = decisiones.find((d) => d.tipo === 'SOBRETIEMPO');
        //Si se encuentra una decisión de sobretiempo y la propiedad 'reconocer' es verdadera, se calculan los minutos extra 25 y 35 según los límites establecidos.
        if (!sobretiempo) r.alertas.push('SOBRETIEMPO_REQUIERE_REVISION');
        else if (sobretiempo.datos.reconocer === true) {
            r.minutos_extra_25 = Math.min(120, r.minutos_extra_observados);
            r.minutos_extra_35 = Math.max(0, r.minutos_extra_observados - 120);
        }
    }
}

/**
 * Función que evalúa las marcaciones de asistencia de un empleado para un día específico, considerando el horario laboral, la jornada histórica, 
 * las decisiones de asistencia y las ausencias registradas.
 * Esta función calcula los intervalos trabajados a partir de las marcas registradas y el horario laboral, y luego evalúa las tardanzas iniciales y en el retorno del refrigerio.
 * También aplica las decisiones de asistencia relacionadas con el sobretiempo y actualiza el objeto ResultadoDia con los minutos extra 25 y 35 según corresponda.
 * @param r - Objeto ResultadoDia que contiene la información del día evaluado, incluyendo las marcas de asistencia y los minutos trabajados.
 * @param horario - Objeto HorarioDia que representa el horario laboral del empleado para el día evaluado, incluyendo la hora de entrada y salida.
 * @param jornada - Objeto JornadaHistorica que representa la jornada laboral histórica del empleado, incluyendo la tolerancia de minutos y la política de tolerancia.
 * @param decisiones - Arreglo de decisiones de asistencia que pueden incluir decisiones relacionadas con ausencias, permisos y sobretiempo.
 * @param programado - Arreglo de intervalos que representan el horario programado del trabajador para el día.
 * @param conGoce - Arreglo de intervalos que representan las ausencias con goce de sueldo para el día.
 * @param sinGoce - Arreglo de intervalos que representan las ausencias sin goce de sueldo para el día.
 * @param aprobadas - Arreglo de solicitudes de asistencia aprobadas para el día, que pueden afectar la evaluación de ausencias y faltas.
 * @returns - Objeto ResultadoDia actualizado con la evaluación de las marcaciones, incluyendo los minutos trabajados, tardanzas, salidas anticipadas y alertas generadas.
 * @throws RangeError si los intervalos de tiempo no son válidos o si los datos de entrada no cumplen con los requisitos de formato o consistencia.
 */
export function evaluarMarcaciones(r: ResultadoDia, horario: HorarioDia, jornada: JornadaHistorica, decisiones: DecisionAsistencia[], programado: Intervalo[], conGoce: Intervalo[], sinGoce: Intervalo[], aprobadas: SolicitudAsistencia[]): ResultadoDia {
    //Calcula los intervalos trabajados a partir de las marcas registradas y el horario laboral.
    const trabajado = intervalosTrabajados(r.marcas, horario);
    if (!trabajado) {
        r.estado = 'MARCACION_INCOMPLETA';
        r.alertas.push('SECUENCIA_DE_MARCACIONES_INCOMPLETA_O_INVALIDA');
        return r;
    }

    //Si no hay faltantes en la asistencia, se considera que la asistencia está registrada correctamente y se actualizan los minutos trabajados.
    r.estado = 'ASISTENCIA_REGISTRADA';
    r.minutos_trabajados = duracion(trabajado);
    //Si hay solicitudes de vacaciones aprobadas, se agrega una alerta indicando que las marcaciones durante las vacaciones requieren revisión.
    if (aprobadas.some((s) => s.tipo === 'VACACIONES')) 
        r.alertas.push('MARCACIONES_DURANTE_VACACIONES_REQUIEREN_REVISION');
    
    //Si los intervalos trabajados no coinciden con los intervalos sin goce, se agrega una alerta indicando que hay un permiso sin goce que coincide con el trabajo.
    if (duracion(restar(trabajado, sinGoce)) !== duracion(trabajado)) 
        r.alertas.push('PERMISO_SIN_GOCE_COINCIDE_CON_TRABAJO');

    //Se calculan los faltantes en la asistencia.
    const faltantes = restar(programado, [...trabajado, ...conGoce, ...sinGoce]);

    //Se calcula la tardanza inicial considerando los intervalos faltantes y la primera marca registrada.
    const primeraEntrada = minutos(r.marcas[0].hora);
    const tardanzaInicial = duracion(faltantes.flatMap(([inicio, fin]) => (inicio < primeraEntrada ? [[inicio, Math.min(fin, primeraEntrada)] as Intervalo] : [])));
    if (tardanzaInicial <= jornada.tolerancia_minutos) {
        r.minutos_tardanza = 0;
    } else if (jornada.politica_tolerancia === 'EXCESO') {
        r.minutos_tardanza = tardanzaInicial - jornada.tolerancia_minutos;
    } else {
        r.minutos_tardanza = tardanzaInicial;
    }

    //Se calcula la tardanza en el retorno del refrigerio considerando los intervalos programados, trabajados y faltantes.
    const tardanzaRetorno = calcularTardanzaRetorno(programado, trabajado, faltantes);
    r.minutos_tardanza += tardanzaRetorno;
    r.minutos_salida_anticipada = duracion(faltantes) - tardanzaInicial - tardanzaRetorno;
    r.minutos_extra_observados = duracion(restar(trabajado, programado));
    //Se aplican las decisiones de asistencia relacionadas con el sobretiempo, actualizando los minutos extra 25 y 35 según corresponda.
    aplicarSobretiempo(r, decisiones);
    return r;
}
