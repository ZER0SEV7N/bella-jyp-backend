//src/modules/asistencia/use-cases/asistencias/importarMarcaciones.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';
import type { MultipartFile } from '@fastify/multipart';
import { BadRequestException, Injectable } from '@nestjs/common';
import { prepararImportacion } from '../../helpers/preparar-importacion.helper';
import { ImportarMarcacionesService } from '../../services/importar-marcaciones.service';

/**
 * Caso de uso para importar marcaciones de asistencia desde un archivo Excel.
 * Este caso de uso valida el archivo Excel, prepara los datos para la importación y luego llama al servicio de importación
 * para guardar las marcaciones en la base de datos. La operación se realiza dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
 * @requires - PrismaService para acceder a la base de datos y realizar operaciones de lectura y escritura.
 * @requires - ImportarMarcacionesService para procesar los datos preparados de la importación y guardar las nuevas marcaciones.
 * @param archivo - El archivo Excel que contiene las marcaciones a importar.
 * @param actor - El actor que realiza la operación de importación.
 * @returns - Promesa que se resuelve con el resultado de la importación si es exitosa.
 * @throws - Error de tipo BadRequestException si el archivo Excel contiene errores o no se puede procesar.
 */
@Injectable()
export class ImportarMarcacionesUseCase {
    constructor(private readonly prisma: PrismaService, private readonly importador: ImportarMarcacionesService) {}
    
    /**
     * Ejecuta el caso de uso para importar marcaciones de asistencia desde un archivo Excel.
     * Valida el archivo Excel, prepara los datos para la importación y luego llama al servicio de importación
     * para guardar las marcaciones en la base de datos. La operación se realiza dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
     * @param archivo - El archivo Excel que contiene las marcaciones a importar.
     * @param actor - El actor que realiza la operación de importación.
     * @returns - Promesa que se resuelve con el resultado de la importación si es exitosa.
     * @throws - Error de tipo BadRequestException si el archivo Excel contiene errores o no se puede procesar.
     */
    async execute(archivo: MultipartFile, actor: ActorOperacion) {
        const preparada = await prepararImportacion(this.prisma, archivo);
        const errores = preparada.vista.errores;
        if (errores.length)throw new BadRequestException({
            title: 'Excel con errores',
            detail: 'No se importó ninguna fila. Corrija los errores antes de confirmar.',
            errores
        });
        return this.importador.guardar(preparada, actor);
    }
}
