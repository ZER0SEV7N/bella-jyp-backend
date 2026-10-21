//src/modules/asistencia/use-cases/asistencias/validarImportacionMarcaciones.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import type { MultipartFile } from '@fastify/multipart';
import { Injectable } from '@nestjs/common';
import { prepararImportacion } from '../../helpers/preparar-importacion.helper';

/**
 * Caso de uso para validar la importación de marcaciones de asistencia desde un archivo Excel.
 * Este caso de uso valida el archivo Excel y prepara los datos para la importación, devolviendo un resumen de la vista de importación.
 * La operación se realiza dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
 * @requires - PrismaService para acceder a la base de datos y realizar operaciones de lectura y escritura.
 * @param archivo - El archivo Excel que contiene las marcaciones a validar.
 * @returns - Promesa que se resuelve con el resumen de la vista de importación si es exitosa.
 * @throws - Error de tipo BadRequestException si el archivo Excel contiene errores o no se puede procesar.
 */
@Injectable()
export class ValidarImportacionMarcacionesUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para validar la importación de marcaciones de asistencia desde un archivo Excel.
     * Valida el archivo Excel y prepara los datos para la importación, devolviendo un resumen de la vista de importación.
     * La operación se realiza dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
     * @param archivo - El archivo Excel que contiene las marcaciones a validar.
     * @returns - Promesa que se resuelve con el resumen de la vista de importación si es exitosa.
     * @throws - Error de tipo BadRequestException si el archivo Excel contiene errores o no se puede procesar.
     */
    async execute(archivo: MultipartFile) {
        const { vista } = await prepararImportacion(this.prisma, archivo);
        return { ...vista, confirmable: vista.errores.length === 0 };
    }
}
