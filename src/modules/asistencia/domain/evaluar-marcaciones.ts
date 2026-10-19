import type { DecisionAsistencia, HorarioDia, JornadaHistorica, ResultadoDia, SolicitudAsistencia } from './asistencia.types';
import type { Intervalo } from './intervalos-asistencia';
import { duracion, intervalosTrabajados, minutos, restar } from './intervalos-asistencia';

function calcularTardanzaRetorno(programado: Intervalo[], trabajado: Intervalo[], faltantes: Intervalo[]): number {
    //El retorno tardío del refrigerio es tardanza; la tolerancia inicial no se vuelve a aplicar.
    let tardanzaRetorno = 0;
    for (const [inicio, fin] of programado.slice(1)) {
        const retorno = trabajado.find(([desde, hasta]) => hasta > inicio && desde < fin);
        if (retorno && retorno[0] > inicio)
            tardanzaRetorno += duracion(
                faltantes.flatMap(([desde, hasta]) =>
                    hasta <= inicio || desde >= retorno[0] ? [] : [[Math.max(inicio, desde), Math.min(retorno[0], hasta)] as Intervalo]
                )
            );
    }

    return tardanzaRetorno;
}

/** Los minutos observados se conservan aunque todavía no exista reconocimiento del sobretiempo. */
function aplicarSobretiempo(r: ResultadoDia, decisiones: DecisionAsistencia[]): void {
    if (r.minutos_extra_observados > 0) {
        const sobretiempo = decisiones.find((d) => d.tipo === 'SOBRETIEMPO');
        if (!sobretiempo) r.alertas.push('SOBRETIEMPO_REQUIERE_REVISION');
        else if (sobretiempo.datos.reconocer === true) {
            r.minutos_extra_25 = Math.min(120, r.minutos_extra_observados);
            r.minutos_extra_35 = Math.max(0, r.minutos_extra_observados - 120);
        }
    }
}

/** Calcula únicamente la jornada con marcas; las justificaciones ya se resolvieron por intervalo. */
export function evaluarMarcaciones(r: ResultadoDia, horario: HorarioDia, jornada: JornadaHistorica, decisiones: DecisionAsistencia[], programado: Intervalo[], conGoce: Intervalo[], sinGoce: Intervalo[], aprobadas: SolicitudAsistencia[]): ResultadoDia {
    const trabajado = intervalosTrabajados(r.marcas, horario);
    if (!trabajado) {
        r.estado = 'MARCACION_INCOMPLETA';
        r.alertas.push('SECUENCIA_DE_MARCACIONES_INCOMPLETA_O_INVALIDA');
        return r;
    }
    r.estado = 'ASISTENCIA_REGISTRADA';
    r.minutos_trabajados = duracion(trabajado);
    if (aprobadas.some((s) => s.tipo === 'VACACIONES')) r.alertas.push('MARCACIONES_DURANTE_VACACIONES_REQUIEREN_REVISION');
    if (duracion(restar(trabajado, sinGoce)) !== duracion(trabajado)) r.alertas.push('PERMISO_SIN_GOCE_COINCIDE_CON_TRABAJO');
    const faltantes = restar(programado, [...trabajado, ...conGoce, ...sinGoce]);
    const primeraEntrada = minutos(r.marcas[0].hora);
    const tardanzaInicial = duracion(
        faltantes.flatMap(([inicio, fin]) => (inicio < primeraEntrada ? [[inicio, Math.min(fin, primeraEntrada)] as Intervalo] : []))
    );
    r.minutos_tardanza =
        tardanzaInicial <= jornada.tolerancia_minutos
            ? 0
            : jornada.politica_tolerancia === 'EXCESO'
              ? tardanzaInicial - jornada.tolerancia_minutos
              : tardanzaInicial;
    const tardanzaRetorno = calcularTardanzaRetorno(programado, trabajado, faltantes);
    r.minutos_tardanza += tardanzaRetorno;
    r.minutos_salida_anticipada = duracion(faltantes) - tardanzaInicial - tardanzaRetorno;
    r.minutos_extra_observados = duracion(restar(trabajado, programado));
    aplicarSobretiempo(r, decisiones);
    return r;
}
