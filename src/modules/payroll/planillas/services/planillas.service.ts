//src/modules/payroll/planillas/services/planillas.service.ts
import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CongelarPlanillaDto, ListarPlanillasDto, RegistrarDesembolsoDto } from '@jyp/shared-contracts';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { PayrollPoolService } from '@/workers/calculo-masivo/payroll-pool.service';
import { ActorOperacion, bloquearEmpleado, transaccionAsistencia } from '@/modules/asistencia/services/asistencia-transaccion.helper';
import { cargarContextoAsistencia, huellaAsistencia } from '@/modules/asistencia/services/asistencia-contexto.helper';
import { corteRetencionesQuinta, VERSION_MOTOR_PLANILLA } from '../domain/calcular-planillas';
import type { EntradaPlanilla } from '../domain/planilla.types';

const CODIGOS = ['RMV', 'UIT', 'ESSALUD_PCT', 'ONP_PCT', 'VIDA_LEY_PCT'] as const; //Códigos de conceptos que se consideran "estáticos" y no dependen de la planilla específica.
const huella = (datos: unknown) => createHash('sha256').update(JSON.stringify(datos)).digest('hex'); //Función para generar un hash SHA-256 de los datos de la planilla, utilizado para verificar cambios en la configuración de la planilla.

@Injectable()
export class PlanillasService {
    constructor(private readonly prisma: PrismaService, 
        private readonly piscina: PayrollPoolService
    ) {}

    async generar(empleadoId: string, periodo: string, actor: ActorOperacion, trabajoId?: string) {
        const preparado = await transaccionAsistencia(this.prisma, actor, tx => this.preparar(tx, empleadoId, periodo));
        let resultado: Awaited<ReturnType<PayrollPoolService['calcular']>>; //Se declara la variable resultado para almacenar el resultado del cálculo de la planilla.

        try {
            resultado = await this.piscina.calcular(preparado.entrada);
        } catch (error) {
            //Solo una regla del motor es un error de datos; una falla del hilo debe activar el reintento técnico.
            if (error instanceof RangeError) throw new BadRequestException(error.message);
            throw error;
        }

        //Se realiza una transacción para guardar el resultado del cálculo de la planilla en la base de datos.
        return transaccionAsistencia(this.prisma, actor, async tx => {
            const actual = await this.preparar(tx, empleadoId, periodo);
            if (actual.hash !== preparado.hash) 
                throw new ConflictException('Las fuentes cambiaron durante el cálculo. Vuelva a generar la planilla.');

            const existente = await tx.historial_planillas.findUnique({ where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } } });
            if (existente?.fuente_hash === actual.hash && existente.snapshot_calculo) 
                return existente;

            const { version_motor: _version, ...montos } = resultado;
            const snapshot = { ...actual, resultado, version_motor: VERSION_MOTOR_PLANILLA, generado_por: actor.id, trabajo_id: trabajoId ?? null };
            return tx.historial_planillas.upsert({
                where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } },
                create: { id: IdentityGenerator.generateId(), empleado_id: empleadoId, periodo, ...montos, estado: 'ABIERTO', incidencia_version: actual.incidencia_version, fuente_hash: actual.hash, snapshot_calculo: snapshot as unknown as Prisma.InputJsonValue },
                update: { ...montos, version: { increment: 1 }, incidencia_version: actual.incidencia_version, fuente_hash: actual.hash, snapshot_calculo: snapshot as unknown as Prisma.InputJsonValue }
            });
        });
    }

    private async preparar(tx: Prisma.TransactionClient, empleadoId: string, periodo: string) {
        const { year, month } = ServerTime.validarPeriodo(periodo);
        if (periodo > ServerTime.obtenerPeriodoActual) throw new BadRequestException('No se puede liquidar un período futuro.');
        await bloquearEmpleado(tx, empleadoId);
        const existente = await tx.historial_planillas.findUnique({ where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } }, select: { estado: true } });
        if (existente && existente.estado !== 'ABIERTO') throw new ConflictException(`La planilla está ${existente.estado}.`);
        const incidencia = await tx.incidencias_mes.findUnique({ where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } } });
        if (!incidencia || incidencia.estado !== 'APROBADO' || !incidencia.vigente || !incidencia.completo || incidencia.pendientes) throw new ConflictException('Se requiere una asistencia aprobada, vigente, completa y sin pendientes.');
        const contexto = await cargarContextoAsistencia(tx, empleadoId, periodo, new Date());
        if (huellaAsistencia(contexto) !== incidencia.fuente_hash) throw new ConflictException('La asistencia aprobada no corresponde a sus fuentes actuales.');
        const empleado = await tx.empleados.findUnique({ where: { id: empleadoId }, select: { id: true, nombre: true, apellido: true, nro_documento: true, asig_familiar: true, fecha_inicio: true, fecha_cese: true, cargo: { select: { nombre: true } }, area: { select: { nombre: true } } } });
        const financiero = await tx.dato_financiero.findUnique({ where: { empleado_id: empleadoId, deleted_at: null }, include: { regimen_pension: true } });
        if (!financiero || !empleado) throw new NotFoundException('El colaborador necesita datos financieros registrados.');
        if (empleado.fecha_cese && empleado.fecha_cese.toISOString().slice(0, 7) === periodo)
            throw new BadRequestException('El mes de cese requiere liquidación y regularización de beneficios. Este motor mensual todavía no liquida ceses.');
        const referencia = new Date(Date.UTC(year, month, 0));
        const parametros = await tx.parametro_legal.findMany({ where: { codigo: { in: [...CODIGOS] }, vigente_desde: { lte: referencia }, OR: [{ vigente_hasta: null }, { vigente_hasta: { gte: referencia } }] }, orderBy: [{ codigo: 'asc' }, { vigente_desde: 'asc' }] });
        for (const codigo of CODIGOS)
            if (parametros.filter(p => p.codigo === codigo).length !== 1) throw new ConflictException(`Debe existir una sola vigencia de ${codigo} para ${periodo}.`);
        const valores = Object.fromEntries(parametros.map(p => [p.codigo, p.valor.toString()])) as EntradaPlanilla['parametros'];
        const pension = financiero.regimen_pension.nombre.trim().toUpperCase();
        const esOnp = pension === 'ONP';
        if (!esOnp && !['AFP', 'SPP', 'SPP / AFP'].includes(pension)) throw new BadRequestException('El régimen previsional no está soportado.');
        const comisiones = esOnp ? [] : await tx.comisiones_afp.findMany({ where: { afp_id: financiero.id_tipo_afp, periodo_inicio: { lte: referencia }, OR: [{ periodo_final: null }, { periodo_final: { gte: referencia } }] }, orderBy: { id: 'asc' } });
        if (!esOnp && (!financiero.id_tipo_afp || comisiones.length !== 1)) throw new ConflictException('Se requiere una sola comisión AFP vigente para el período.');
        const anteriores = await tx.historial_planillas.findMany({ where: { empleado_id: empleadoId, periodo: { gte: `${year}-01`, lt: periodo }, deleted_at: null }, orderBy: { periodo: 'asc' } });
        const primerMes = Math.max(1, empleado.fecha_inicio!.getUTCFullYear() === year ? empleado.fecha_inicio!.getUTCMonth() + 1 : 1);
        for (let mes = primerMes; mes < month; mes++) {
            const texto = `${year}-${String(mes).padStart(2, '0')}`;
            if (!anteriores.some(p => p.periodo === texto && ['CONGELADO', 'DECLARADO'].includes(p.estado)))
                throw new ConflictException(`Falta el historial congelado de ${texto}. Debe registrar los acumulados previos antes de calcular ${periodo}.`);
        }
        const cerradas = anteriores.filter(p => ['CONGELADO', 'DECLARADO'].includes(p.estado));
        const suma = (filas: typeof anteriores, campo: 'descuento_quinta' | 'total_ingresos') => filas.reduce((total, p) => total.add(p[campo]), new Prisma.Decimal(0));
        const corte = corteRetencionesQuinta(month).hastaMes;
        const retenciones = suma(cerradas.filter(p => Number(p.periodo.slice(5)) <= corte), 'descuento_quinta');
        const ingresos = cerradas.reduce((total, p) => total.add(p.total_ingresos).sub(p.descuento_faltas).sub(p.descuento_tardanzas).sub(p.descuento_sin_goce).sub(p.descuento_dso), new Prisma.Decimal(0));
        const pagos = await tx.adelanto_desembolso.findMany({ where: { empleado_id: empleadoId, periodo_descuento: periodo }, orderBy: { id: 'asc' } });
        const novedades = await tx.novedad_planilla.findMany({ where: { empleado_id: empleadoId, periodo }, orderBy: { id: 'asc' } });
        if (novedades.some(n => n.estado === 'PENDIENTE')) throw new ConflictException('El contador debe resolver las novedades pendientes antes de calcular la planilla.');
        const aprobadas = novedades.filter(n => n.estado === 'APROBADO');
        const sumarNovedad = (tipo: string) => aprobadas.filter(n => n.tipo === tipo).reduce((total, n) => total.add(n.monto), new Prisma.Decimal(0));
        if (aprobadas.filter(n => n.tipo === 'DESCUENTO_DSO').length > 1) throw new ConflictException('Debe existir una sola determinación aprobada del descanso semanal por período.');
        const adelantos = pagos.reduce((total, p) => total.add(p.monto), new Prisma.Decimal(0));
        const comision = comisiones[0];
        //La gratificación mensual solo se calcula para semestres completos sin casuísticas de beneficios pendientes.
        let mesesGratificacion = 0;
        if (month === 7 || month === 12) {
            const desde = month === 7 ? 1 : 7, hasta = month === 7 ? 6 : 12;
            for (let mes = desde; mes <= hasta; mes++) {
                const inicio = new Date(Date.UTC(year, mes - 1, 1)), fin = new Date(Date.UTC(year, mes, 0));
                if (empleado.fecha_inicio! > inicio || empleado.fecha_cese && empleado.fecha_cese < fin) continue;
                const registro = mes === month ? incidencia : cerradas.find(p => p.periodo === `${year}-${String(mes).padStart(2, '0')}`);
                if (!registro) throw new ConflictException('Faltan meses del semestre para verificar la gratificación.');
                //Los meses anteriores se verifican con su instantánea, no con los datos actuales del colaborador.
                const fuente = 'faltas' in registro ? registro : (registro.snapshot_calculo as unknown as { entrada?: EntradaPlanilla } | null)?.entrada;
                if (!fuente) throw new ConflictException('El semestre contiene planillas sin instantánea verificable.');
                if (fuente.faltas > 0 || fuente.dias_sin_goce > 0 || fuente.minutos_sin_goce > 0) throw new ConflictException('La gratificación con ausentismo requiere el cálculo específico de beneficios.');
                if (fuente.minutos_extras_25 > 0 || fuente.minutos_extras_35 > 0 || 'bono_extraordinario' in fuente && new Prisma.Decimal(fuente.bono_extraordinario).gt(0))
                    throw new ConflictException('La gratificación con remuneraciones variables requiere verificar su regularidad y promedio.');
                mesesGratificacion++;
            }
        }
        const entrada: EntradaPlanilla = {
            periodo, empleado_id: empleadoId, sueldo_basico: financiero.sueldo_basico.toString(), asignacion_familiar: empleado.asig_familiar,
            dias_vinculo: incidencia.dias_vinculo, dias_remunerables: incidencia.dias_trabajados, faltas: incidencia.faltas, dias_sin_goce: incidencia.dias_sin_goce,
            minutos_tardanza: incidencia.minutos_tardanza, minutos_salida_anticipada: incidencia.minutos_salida_anticipada, minutos_sin_goce: incidencia.minutos_sin_goce,
            minutos_extras_25: incidencia.minutos_extras_25, minutos_extras_35: incidencia.minutos_extras_35, horas_diarias: '8',
            regimen: esOnp ? 'ONP' : 'AFP', tipo_comision: financiero.tipo_comision, regimen_salud: financiero.regimen_salud, eps_adicional: financiero.eps_costo_adicional?.toString() ?? '0',
            afp: comision ? { aporte: comision.aporte_obligatorio.toString(), prima: comision.prima_seguro.toString(), flujo: comision.comision_sobre_ra.toString(), flujo_mixta: comision.comision_flujo_mixta?.toString() ?? null, tope_seguro: comision.remuneracion_maxima_asegurable?.toString() ?? null } : null,
            parametros: valores, ingresos_previos: ingresos.toString(), retenciones_hasta_corte: retenciones.toString(), gratificaciones_previas: suma(cerradas, 'total_ingresos').toString(), meses_gratificacion: mesesGratificacion, adelantos_desembolsados: adelantos.toString(),
            bono_extraordinario: sumarNovedad('BONO_EXTRAORDINARIO_REMUNERATIVO').toString(), descuento_autorizado: sumarNovedad('DESCUENTO_AUTORIZADO').toString(), descuento_dso: aprobadas.some(n => n.tipo === 'DESCUENTO_DSO') ? sumarNovedad('DESCUENTO_DSO').toString() : null
        };
        const cabecera = { nombre_completo: `${empleado.nombre ?? ''} ${empleado.apellido ?? ''}`.trim(), nro_documento: empleado.nro_documento, cargo: empleado.cargo.nombre, area: empleado.area.nombre, asignacion_familiar: empleado.asig_familiar, dias_laborados: incidencia.dias_trabajados, regimen_pension: pension };
        const empresa = { nombreEmpresa: process.env.EMPRESA_NOMBRE ?? null, ruc: process.env.EMPRESA_RUC ?? null, direccion: process.env.EMPRESA_DIRECCION ?? null };
        const fuentes = { entrada, cabecera, empresa, incidencia_version: incidencia.version, asistencia_hash: incidencia.fuente_hash, parametros: parametros.map(p => ({ id: p.id, valor: p.valor.toString() })), comisiones: comisiones.map(c => c.id), desembolsos: pagos.map(p => p.id), novedades: aprobadas.map(n => ({ id: n.id, version: n.version, tipo: n.tipo, monto: n.monto.toString() })), version_motor: VERSION_MOTOR_PLANILLA };
        return { entrada, cabecera, empresa, incidencia_version: incidencia.version, hash: huella(fuentes) };
    }

    async congelar(id: string, dto: CongelarPlanillaDto, actor: ActorOperacion) {
        return transaccionAsistencia(this.prisma, actor, async tx => {
            const planilla = await tx.historial_planillas.findUnique({ where: { id } });
            if (!planilla) throw new NotFoundException('La planilla no existe.');
            if (planilla.version !== dto.version) throw new ConflictException('La planilla cambió desde que fue consultada.');
            const preparado = await this.preparar(tx, planilla.empleado_id, planilla.periodo);
            if (preparado.hash !== planilla.fuente_hash || !planilla.snapshot_calculo) throw new ConflictException('La planilla debe regenerarse porque sus fuentes cambiaron.');
            const esperado = await this.piscina.calcular(preparado.entrada);
            for (const [campo, valor] of Object.entries(esperado)) {
                if (campo === 'version_motor') continue;
                const guardado = (planilla as unknown as Record<string, unknown>)[campo];
                if (valor === null ? guardado !== null : guardado === null || guardado === undefined || !new Prisma.Decimal(String(guardado)).eq(String(valor)))
                    throw new ConflictException('Los montos almacenados no concilian con el cálculo. Genere nuevamente la planilla.');
            }
            if (!preparado.empresa.nombreEmpresa || !preparado.empresa.direccion || !/^\d{11}$/.test(preparado.empresa.ruc ?? '')) throw new BadRequestException('Configure EMPRESA_NOMBRE, EMPRESA_RUC y EMPRESA_DIRECCION antes de validar una planilla.');
            return tx.historial_planillas.update({ where: { id, version: dto.version, estado: 'ABIERTO' }, data: { estado: 'CONGELADO', validado_por: actor.id, validado_en: new Date(), comentarios: dto.motivo, version: { increment: 1 } } });
        });
    }

    async listar(query: ListarPlanillasDto) {
        const where = { periodo: query.periodo, deleted_at: null };
        const [total, data] = await this.prisma.$transaction([this.prisma.historial_planillas.count({ where }), this.prisma.historial_planillas.findMany({ where, orderBy: { empleado_id: 'asc' }, skip: (query.page - 1) * query.limit, take: query.limit, omit: { snapshot_calculo: true } })]);
        return { data, meta: { total, page: query.page, limit: query.limit } };
    }

    async detalle(id: string) {
        const planilla = await this.prisma.historial_planillas.findUnique({ where: { id, deleted_at: null } });
        if (!planilla) throw new NotFoundException('La planilla no existe.');
        return planilla;
    }

    async registrarDesembolso(dto: RegistrarDesembolsoDto, actor: ActorOperacion) {
        if (dto.fecha > ServerTime.fechaPeru(new Date())) throw new BadRequestException('El desembolso no puede tener una fecha futura.');
        return transaccionAsistencia(this.prisma, actor, async tx => {
            const solicitud = await tx.solicitud.findUnique({ where: { id: dto.solicitud_id, deleted_at: null } });
            if (!solicitud || solicitud.tipo !== 'ADELANTO_SUELDO' || solicitud.estado !== 'APROBADA' || !solicitud.monto?.gt(0)) throw new ConflictException('Se requiere una solicitud de adelanto aprobada con monto válido.');
            await bloquearEmpleado(tx, solicitud.empleado_id);
            return tx.adelanto_desembolso.create({ data: { id: IdentityGenerator.generateId(), solicitud_id: solicitud.id, empleado_id: solicitud.empleado_id, monto: solicitud.monto, fecha: ServerTime.desdeFechaSimple(dto.fecha), periodo_descuento: dto.periodo_descuento, referencia: dto.referencia, usuario_id: actor.id } });
        });
    }
}
