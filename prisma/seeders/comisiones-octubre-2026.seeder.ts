//prisma/seeders/comisiones-octubre-2026.seeder.ts
import { IdentityGenerator } from '../../src/common/utils/uuid.util';
import { ClienteSeed, comprobarValor } from './vigencias.helper';

/** 
 * SBS, devengue 2026-10, consultado el 21/10/2026.
 * La comisión anual sobre saldo NO se descuenta del sueldo mensual.
 * https://www.sbs.gob.pe/app/spp/empleadores/comisiones_spp/paginas/comision_prima.aspx
 */
export async function seedComisionesOctubre2026(prisma: ClienteSeed) {
    // Comisiones de AFP para el período 2026-10
    const tasas = [
        { nombre: 'HABITAT', flujo: '1.47', saldo: '1.25' },
        { nombre: 'INTEGRA', flujo: '1.55', saldo: '0.78' },
        { nombre: 'PRIMA', flujo: '1.60', saldo: '1.25' },
        { nombre: 'PROFUTURO', flujo: '1.69', saldo: '0.68' },
    ];

    // Período de vigencia de las comisiones: 2026-10-01 a 2026-12-31
    const inicio = new Date('2026-10-01');
    const fin = new Date('2026-12-31');

    // Insertar o verificar las comisiones de cada AFP
    for (const tasa of tasas) {
        const afp = await prisma.tipo_afp.findFirstOrThrow({ where: { nombre: tasa.nombre, regimen_pension: { nombre: 'SPP' } } });
        const vigentes = await prisma.comisiones_afp.findMany({ where: { afp_id: afp.id, periodo_inicio: { lte: fin }, OR: [{ periodo_final: null }, { periodo_final: { gte: inicio } }] } });
        const valores = { aporte_obligatorio: '10', prima_seguro: '1.37', comision_sobre_ra: tasa.flujo, comision_mixta: tasa.saldo, comision_flujo_mixta: '0', remuneracion_maxima_asegurable: '12732.70' };
        if (vigentes.length > 0) {

            // Si ya existe una vigencia para este período, verificar que los valores coincidan
            const actual = vigentes[0];

            // Si hay más de una vigencia o los períodos no coinciden exactamente, lanzar un error
            if (vigentes.length !== 1 || actual.periodo_inicio.getTime() !== inicio.getTime() || actual.periodo_final?.getTime() !== fin.getTime()) 
                throw new Error(`${tasa.nombre}: revise las vigencias existentes; el seeder no cierra ni reemplaza períodos.`);
            
            // Verificar que los valores coincidan con los esperados
            for (const [campo, esperado] of Object.entries(valores)) {
                const valor = actual[campo as keyof typeof valores];
                
                // Si el valor es nulo, lanzar un error indicando que falta ese campo
                if (valor === null) 
                    throw new Error(`${tasa.nombre}: falta ${campo}.`);
                
                comprobarValor(valor, esperado, `${tasa.nombre}.${campo}`);
            }
            continue;
        }
        await prisma.comisiones_afp.create({ data: { id: IdentityGenerator.generateId(), afp_id: afp.id, ...valores, periodo_inicio: inicio, periodo_final: fin } });
    }
}
