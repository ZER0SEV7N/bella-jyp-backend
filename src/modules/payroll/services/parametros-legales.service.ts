//src/modules/payroll/services/parametros-legales.service.ts
import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import Redis from "ioredis";
import { REDIS_CLIENT } from "@/common/cls/redis.constants";
import dayjs from "dayjs";

@Injectable()
export class ParametrosLegalesService{
    private readonly REDIS_PREFIX = 'payroll:config:';

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

    async obtenerValor(codigo: string, fechaReferencia: Date = new Date()): Promise<number> {
        const periodoKey = dayjs(fechaReferencia).format('YYYY-MM');
        const cacheKey = `${this.REDIS_PREFIX}${codigo}:${periodoKey}`;

        //Intentar resolver desde el cache volatil en redis
        const cachedValue = await this.redis.get(cacheKey);
        if(cachedValue !== null) return parseFloat(cachedValue);

        //Consulta en base de datos evaluando los limites de vigencia del parametro legal
        const parametro = await this.prisma.parametro_legal.findFirst({
            where: {
                codigo: codigo.trim().toUpperCase(),
                vigente_desde: { lte: fechaReferencia },
                OR: [
                    { vigente_hasta: { gte: fechaReferencia } },
                    { vigente_hasta: null },
                ]
            },
            orderBy: { vigente_desde: 'desc' },
            select: { valor: true }
        });

        if (!parametro) throw new NotFoundException(`No se encontró configuración vigente para el parámetro legal '${codigo}' al ${dayjs(fechaReferencia).format('YYYY-MM-DD')}.`);

        const valorNumerico = Number(parametro.valor);

        //Persistir en Redis con un tiempo de expiración de 24 horas (86400 segundos)
        await this.redis.set(cacheKey, valorNumerico.toString(), 'EX', 86400);

        return valorNumerico;
    }

    /**
     * Metodo para invalidar el cache de un parametro legal especifico.
     * Esto es útil cuando se actualiza un parametro legal y se desea que las futuras consultas reflejen el nuevo valor sin esperar a que expire el cache.
     * @param codigo - Codigo del parametro legal a invalidar en cache
     */
    async invalidarCache(codigo: string): Promise<void> {
        const keys = await this.redis.keys(`${this.REDIS_PREFIX}${codigo.trim().toUpperCase()}:*`);
        if (keys.length > 0) await this.redis.del(keys);
    }        
}