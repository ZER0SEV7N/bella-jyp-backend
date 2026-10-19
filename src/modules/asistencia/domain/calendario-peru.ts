//Calendario nacional del régimen privado. Los días no laborables públicos no se agregan automáticamente.
export function feriadosNacionalesPeru(year: number): { fecha: string; nombre: string }[] {
    if (!Number.isInteger(year) || year < 1992 || year > 9998) throw new RangeError('El calendario admite años desde 1992 hasta 9998.');
    const fijos: [string, string][] = [
        ['01-01', 'Año Nuevo'], ['05-01', 'Día del Trabajo'], ['06-29', 'San Pedro y San Pablo'],
        ['07-28', 'Fiestas Patrias'], ['07-29', 'Fiestas Patrias'], ['08-30', 'Santa Rosa de Lima'],
        ['10-08', 'Combate de Angamos'], ['11-01', 'Todos los Santos'], ['12-08', 'Inmaculada Concepción'], ['12-25', 'Navidad']
    ];
    //Las incorporaciones recientes no se aplican retroactivamente al recalcular períodos históricos.
    if (year >= 2022) fijos.push(['08-06', 'Batalla de Junín'], ['12-09', 'Batalla de Ayacucho']);
    if (year >= 2023) fijos.push(['06-07', 'Batalla de Arica y Día de la Bandera'], ['07-23', 'Día de la Fuerza Aérea del Perú']);

    //Algoritmo gregoriano de Pascua: Jueves y Viernes Santo son los dos y tres días anteriores.
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = (h + l - 7 * m + 114) % 31 + 1;
    const pascua = new Date(Date.UTC(year, mes - 1, dia));
    const resultado = fijos.map(([fecha, nombre]) => ({ fecha: `${year}-${fecha}`, nombre }));
    for (const [desplazamiento, nombre] of [[3, 'Jueves Santo'], [2, 'Viernes Santo']] as const)
        resultado.push({ fecha: new Date(pascua.getTime() - desplazamiento * 86400000).toISOString().slice(0, 10), nombre });
    return resultado.sort((x, y) => x.fecha.localeCompare(y.fecha));
}
