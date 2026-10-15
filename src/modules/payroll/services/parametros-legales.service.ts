//src/modules/payroll/services/parametros-legales.service.ts
import { Injectable, NotFoundException, ConflictException, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import Redis from 'ioredis';
import { Decimal } from '@prisma/client/runtime/client';
import { REDIS_CLIENT } from '@/common/cls/redis.constants';
import { ServerTime } from '@/common/utils/server-time';

/**
 * Servicio para manejar la obtención y cache de parámetros legales.
 * Este servicio permite consultar el valor vigente de un parámetro legal para una fecha o periodo específico.
 * Implementa cache-side para optimizar el rendimiento y reducir la carga en la base de datos.
 */
@Injectable()
export class ParametrosLegalesService{
    private readonly REDIS_PREFIX = 'payroll:config:';
    private readonly logger = new Logger(ParametrosLegalesService.name);
    
    constructor(
        private readonly prisma: PrismaService,
        @Inject(REDIS_CLIENT) private readonly redis: Redis
    ) {}

    /**
     * Metodo para obtener el valor vigente de un parametro legal para una fecha o periodo especifico.
     * Soporte para cálculos historicos: Si se proporciona una fecha, el método buscará el valor vigente de ese parámetro legal en esa fecha específica.
     * Si no se proporciona una fecha, se asumirá que se desea el valor vigente para el periodo actual.
     * Al utilizar cache-side, se optimiza el rendimiento al reducir la cantidad de consultas a la base de datos para parámetros legales que no cambian con frecuencia.
     * @param codigo - Codigo del parametro legal a consultar
     * @param fechaReferencia - Fecha para la cual se desea obtener el valor vigente del parametro legal. Si no se proporciona, se usará la fecha actual.
     * @returns Valor numerico del parametro legal vigente para la fecha o periodo especifico.
     * @throws NotFoundException si no se encuentra un valor vigente para el parametro legal en la fecha especificada.
     */
    async obtenerValor(codigo: string, fechaReferencia: Date = ServerTime.obtenerFechaSimpleActual): Promise<number> {
        return (await this.obtenerDecimal(codigo, fechaReferencia)).toNumber();
    }

    /**
     * Obtiene el valor decimal vigente de un parametro legal para una fecha o periodo especifico.
     * @param codigo - Codigo del parametro legal a consultar
     * @param fechaReferencia - Fecha para la cual se desea obtener el valor vigente del parametro legal. Si no se proporciona, se usará la fecha actual.
     * @returns Valor decimal del parametro legal vigente para la fecha o periodo especifico.
     * @throws NotFoundException si no se encuentra un valor vigente para el parametro legal en la fecha especificada.
     */
    async obtenerDecimal(codigo: string, fechaReferencia: Date = ServerTime.obtenerFechaSimpleActual): Promise<Decimal> {
        const normalizado = codigo.trim().toUpperCase();
        if (!normalizado) throw new RangeError('El código del parámetro es obligatorio.');
        if (!Number.isFinite(fechaReferencia.getTime())) throw new RangeError('La fecha de referencia es inválida.');

        //Normalizar la fecha a formato YYYY-MM-DD para usarla como parte de la clave de cache
        const fechaTexto = fechaReferencia.toISOString().slice(0, 10);
        const fecha = ServerTime.desdeFechaSimple(fechaTexto);
        const cacheKey = `${this.REDIS_PREFIX}${normalizado}:${fechaTexto}`;

        //Intentar obtener el valor desde la cache de Redis antes de consultar la base de datos
        try {
            const cached = await this.redis.get(cacheKey);
            if (cached !== null) {
                const valor = new Decimal(cached);
                if (valor.isFinite()) return valor;
            }
        } catch {
            this.logger.warn('No se pudo leer el parámetro de la caché. Se consultará PostgreSQL.');
        }

        //Si no se encuentra en cache, consultar la base de datos
        const parametros = await this.prisma.parametro_legal.findMany({
            where: {
                codigo: normalizado,
                vigente_desde: { lte: fecha },
                OR: [{ vigente_hasta: { gte: fecha } }, { vigente_hasta: null }]
            },
            orderBy: { vigente_desde: 'desc' },
            take: 2,
            select: { valor: true }
        });

        //Si no se encuentra un valor vigente o hay vigencias superpuestas, lanzar excepciones apropiadas
        if (parametros.length === 0) throw new NotFoundException(`No existe configuración de ${normalizado} para ${fechaTexto}.`);
        if (parametros.length > 1) throw new ConflictException(`Existen vigencias superpuestas para ${normalizado} en ${fechaTexto}.`);

        //Guardar el valor en cache para futuras consultas y retornar el valor obtenido de la base de datos
        const valor = new Decimal(parametros[0].valor.toString());
        try {
            await this.redis.set(cacheKey, valor.toString(), 'EX', 86400);
        } catch {
            this.logger.warn('No se pudo guardar el parámetro en caché. Se conserva el valor de PostgreSQL.');
        }

        return valor;
    }

    /**
     * Invalidar la cache de un parametro legal especifico.
     * Esto es útil cuando se actualiza un parametro legal y se desea que la próxima consulta obtenga el valor actualizado desde la base de datos.
     * @param codigo - Codigo del parametro legal a invalidar en la cache.
     * @returns void - La función no retorna ningún valor, pero asegura que la cache para el parametro especificado sea eliminada.
     * @throws Error si ocurre un error al intentar invalidar la cache.
     * @note Esta operación puede ser costosa si hay muchas claves en la cache, ya que realiza un escaneo de todas las claves que coinciden con el patrón especificado.
     */
    async invalidarCache(codigo: string): Promise<void> {
        // Fallar permite al caso de uso registrar/reintentar la invalidación tras el commit.
        let cursor = '0';
        do {
            const [siguienteCursor, keys] = await this.redis.scan(cursor, 'MATCH', `${this.REDIS_PREFIX}${codigo.trim().toUpperCase()}:*`, 'COUNT', 500);
            cursor = siguienteCursor;
            for (let inicio = 0; inicio < keys.length; inicio += 500)
                await this.redis.del(...keys.slice(inicio, inicio + 500));
        } while (cursor !== '0');
    }
}