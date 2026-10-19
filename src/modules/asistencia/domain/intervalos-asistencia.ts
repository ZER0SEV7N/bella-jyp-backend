import type { HorarioDia, MarcaDia } from './asistencia.types';

export type Intervalo = [number, number];
export const minutos = (hora: string) => {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
};
export const duracion = (intervalos: Intervalo[]) => intervalos.reduce((total, [inicio, fin]) => total + fin - inicio, 0);

/** Resta intervalos unidos: dos permisos solapados nunca justifican dos veces los mismos minutos. */
export function restar(base: Intervalo[], coberturas: Intervalo[]): Intervalo[] {
    return coberturas.reduce(
        (restantes, [desde, hasta]) =>
            restantes.flatMap(([inicio, fin]) => {
                if (hasta <= inicio || desde >= fin) return [[inicio, fin] as Intervalo];
                const partes: Intervalo[] = [];
                if (desde > inicio) partes.push([inicio, desde]);
                if (hasta < fin) partes.push([hasta, fin]);
                return partes;
            }),
        base
    );
}

export function horarioProgramado(horario: HorarioDia): Intervalo[] | null {
    if (!horario.entrada || !horario.salida) return null;
    const inicio = minutos(horario.entrada),
        fin = minutos(horario.salida);
    //El alcance actual admite jornadas diurnas fijas; los turnos nocturnos requieren otro motor.
    if (fin <= inicio) return null;
    if (!horario.inicio_descanso && !horario.fin_descanso) return [[inicio, fin]];
    if (!horario.inicio_descanso || !horario.fin_descanso) return null;
    const descanso = minutos(horario.inicio_descanso),
        retorno = minutos(horario.fin_descanso);
    if (descanso <= inicio || retorno <= descanso || retorno >= fin) return null;
    return [
        [inicio, descanso],
        [retorno, fin]
    ];
}

/** Solo admite la secuencia completa de dos o cuatro marcas, sin ordenar tipos artificialmente. */
export function intervalosTrabajados(marcas: MarcaDia[], horario: HorarioDia): Intervalo[] | null {
    const tipos = marcas.map((m) => m.tipo).join(',');
    if (!['ENTRADA,SALIDA', 'ENTRADA,SALIDA_ALMUERZO,ENTRADA_ALMUERZO,SALIDA'].includes(tipos)) return null;
    const horas = marcas.map((m) => minutos(m.hora));
    if (horas.some((hora, indice) => indice > 0 && hora <= horas[indice - 1])) return null;
    if (horas.length === 4)
        return [
            [horas[0], horas[1]],
            [horas[2], horas[3]]
        ];
    //Sin marcas de refrigerio se descuenta el descanso programado, sin inventar marcas físicas.
    const descanso: Intervalo[] = horario.inicio_descanso && horario.fin_descanso ? [[minutos(horario.inicio_descanso), minutos(horario.fin_descanso)]] : [];
    return restar([[horas[0], horas[1]]], descanso);
}
