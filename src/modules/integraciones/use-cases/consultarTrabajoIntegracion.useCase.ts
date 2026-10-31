//src/modules/integraciones/use-cases/consultarTrabajoIntegracion.useCase.ts
import { ConflictException, Injectable, NotFoundException,} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ResultadoIntegracionSchema } from '@jyp/shared-contracts';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

/**
 * Caso de uso para consultar el estado y los archivos de un trabajo de integración con el servicio externo de N8N.
 * Este caso de uso maneja la lógica de negocio relacionada con la consulta de trabajos de integración,
 * incluyendo la verificación de la existencia del trabajo, la validación de su estado y la recuperación de los archivos asociados.
 * También se encarga de garantizar la integridad de los archivos mediante la verificación de su hash SHA-256.
 */
@Injectable()
export class ConsultarTrabajoIntegracionUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Consulta el estado de un trabajo de integración por su ID.
     * @param id - El ID del trabajo de integración a consultar.
     * @returns - Un resumen del trabajo de integración, incluyendo su ID, tipo, estado, periodo y si requiere revisión.
     * @throws NotFoundException - Si el trabajo no existe.
     * @throws ConflictException - Si el trabajo está en un estado que no permite la consulta de archivos.
     */
    async execute(id: string) {

        // Se consulta el trabajo de integración en la base de datos, excluyendo los trabajos de tipo 'RESET_PASSWORD'.
        const trabajo = await this.prisma.integracionTrabajo.findUnique({
            where: { id, tipo: { not: 'RESET_PASSWORD' } },
            select: {
                id: true,
                tipo: true,
                estado: true,
                periodo: true,
                creado_en: true,
                finalizado_en: true,
                iniciado_en: true,
                intentos: true,
                resultado: true,
                error: true
            },
        });

        // Si el trabajo no existe, se lanza una excepción NotFoundException.
        if (!trabajo) throw new NotFoundException('Trabajo inexistente.');
        return {
            ...trabajo,
            requiere_revision: trabajo.estado === 'PROCESANDO' && Boolean( trabajo.iniciado_en && Date.now() - trabajo.iniciado_en.getTime() > 65 * 60000 )
        };
    }

    /**
     * Consulta un archivo específico de un trabajo de integración por su ID y nombre.
     * 
     * @param id - El ID del trabajo de integración.
     * @param nombre - El nombre del archivo a consultar.
     * @returns - Un objeto que contiene un stream del archivo, su nombre y tipo MIME.
     * @throws NotFoundException - Si el trabajo o el archivo no existen.
     * @throws ConflictException - Si el trabajo no tiene archivos completos o si hay problemas de integridad con el archivo.
     */
    async archivo(id: string, nombre: string) {
        // Se consulta el trabajo de integración y se verifica que esté en un estado que permita la consulta de archivos.
        const trabajo = await this.execute(id);

        // Si el trabajo no está en estado 'COMPLETADO' o 'PARCIAL', se lanza una excepción ConflictException.
        if (!['COMPLETADO', 'PARCIAL'].includes(trabajo.estado))
            throw new ConflictException('El trabajo todavía no tiene archivos completos.');

        // Se analiza el resultado del trabajo para encontrar el archivo solicitado.
        const resultado = ResultadoIntegracionSchema.parse(trabajo.resultado);
        const archivo = resultado.archivos.find((a) => a.nombre === nombre);

        // Si el archivo no se encuentra en el resultado del trabajo, se lanza una excepción NotFoundException.
        if (!archivo)
            throw new NotFoundException('El archivo no pertenece al trabajo.');
        return this.abrir(id, archivo);
    }

    /**
     * Consulta la boleta de un planilla específica, buscando en los trabajos de integración completados o parciales.
     * @param planillaId - El ID de la planilla para la cual se desea consultar la boleta.
     * @returns - Un objeto que contiene un stream del archivo de la boleta, su nombre y tipo MIME.
     * @throws ConflictException - Si no se encuentra un trabajo de integración con la boleta generada o si hay problemas de integridad con el archivo.
     */
    async boleta(planillaId: string) {
        // Se buscan los trabajos de integración de tipo 'BOLETAS' que estén en estado 'COMPLETADO' o 'PARCIAL' y que contengan la planilla especificada.
        const trabajos = await this.prisma.integracionTrabajo.findMany({
            where: {
                tipo: 'BOLETAS',
                estado: { in: ['COMPLETADO', 'PARCIAL'] },
                planilla_ids: { has: planillaId },
            },

            // Se ordenan los trabajos por fecha de finalización descendente y se limita la búsqueda a los 20 trabajos más recientes.
            orderBy: { finalizado_en: 'desc' },
            take: 20,
            select: { id: true, resultado: true },
        });

        // Se itera sobre los trabajos encontrados para buscar el archivo de la boleta correspondiente a la planilla especificada.
        for (const trabajo of trabajos) {

            // Se analiza el resultado del trabajo para encontrar el archivo de la boleta correspondiente a la planilla.
            const resultado = ResultadoIntegracionSchema.parse( trabajo.resultado );
            // Se busca el archivo de tipo 'application/pdf' que corresponda a la planilla especificada.
            const archivo = resultado.archivos.find((a) => a.planilla_id === planillaId && a.tipo === 'application/pdf');
            
            // Si se encuentra el archivo, se llama al método 'abrir' para obtener un stream del archivo y se retorna.
            if (archivo) return this.abrir(trabajo.id, archivo);
        }

        // Si no se encuentra ningún archivo de boleta para la planilla especificada, se lanza una excepción ConflictException.
        throw new ConflictException('La boleta está pendiente de generación por n8n. Consulte el estado del trabajo de cierre.');
    }

    /**
     * Funcion privada que abre un archivo de un trabajo de integración, verificando su existencia y la integridad del mismo.
     * @param id - El ID del trabajo de integración.
     * @param archivo - Un objeto que contiene información del archivo a abrir, incluyendo su nombre, tipo MIME, tamaño en bytes y hash SHA-256.
     * @returns - Un objeto que contiene un stream del archivo, su nombre y tipo MIME.
     */
    private async abrir(id: string, archivo: { nombre: string; tipo: string; bytes: number; sha256: string }) {
        // Se construye la ruta absoluta del archivo en el sistema de archivos, utilizando la configuración de directorio de integraciones.
        const raiz = resolve(process.env.ARCHIVOS_INTEGRACION_DIR ?? 'archivos/integraciones');
        
        // Se verifica que el archivo exista en la ruta especificada y que sea un archivo regular con el tamaño esperado.
        const ruta = await realpath(resolve(raiz, id, archivo.nombre)).catch(() => {
            throw new NotFoundException('El archivo registrado no está disponible en el almacenamiento.');
        });
        
        // Se verifica que la ruta del archivo esté dentro del directorio raíz de integraciones para evitar accesos no autorizados.
        const raizReal = await realpath(raiz);
        if (!ruta.startsWith(raizReal + sep))
            throw new ConflictException('La ubicación del archivo no es válida.');
        
        // Se obtienen los datos del archivo y se verifica que sea un archivo regular y que su tamaño coincida con el registrado.
        const datos = await stat(ruta);
        if (!datos.isFile() || datos.size !== archivo.bytes)
            throw new ConflictException('El archivo no coincide con su registro.');
        
        // Se verifica el contenido en streaming antes de exponerlo al cliente.
        const hash = createHash('sha256');
        
        // Se calcula el hash SHA-256 del archivo en streaming y se compara con el hash registrado para garantizar la integridad del archivo.
        for await (const parte of createReadStream(ruta)) hash.update(parte);

        // Se compara el hash calculado con el hash registrado en la base de datos para garantizar la integridad del archivo.
        if (hash.digest('hex') !== archivo.sha256)
            throw new ConflictException('La integridad del archivo no coincide con el manifiesto.');
        
        // Se retorna un objeto que contiene un stream del archivo, su nombre y tipo MIME para que pueda ser consumido por el cliente.
        return {
            stream: createReadStream(ruta),
            nombre: archivo.nombre,
            tipo: archivo.tipo,
        };
    }
}
