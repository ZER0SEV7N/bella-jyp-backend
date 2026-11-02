//src/modules/RRHH/common/verificacciones-rrhh.helper.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Función para verificar si un área está activa en la base de datos.
 * Verifica si el área con el ID proporcionado existe y está activa. Si no es así, lanza una excepción NotFoundException.
 * @param prisma - Instancia del servicio Prisma para acceder a la base de datos.
 * @param areaId - ID del área a verificar.
 * @param areaActualId - ID del área actual (opcional). Si se proporciona y coincide con areaId, no se realiza la verificación.
 * @returns - Una promesa que se resuelve si el área es válida y activa, o lanza una excepción si no lo es.
 * @throws NotFoundException si el área no existe o está inactiva.
 */
export async function verificarAreaActiva(prisma: PrismaService, areaId?: string, areaActualId?: string): Promise<void> {
    //Si no se proporciona un ID de área o si coincide con el ID del área actual, no se realiza ninguna verificación.
    if (!areaId || areaId === areaActualId) return;

    //Busca el área en la base de datos utilizando el ID proporcionado y verifica si está activa.
    const area = await prisma.area.findUnique({
        where: { id: areaId, deleted_at: null },
        select: { id: true, activo: true },
    });

    //Si el área no existe o está inactiva, lanza una excepción NotFoundException con un mensaje detallado.
    if (!area || !area.activo) throw new NotFoundException({
        title: 'Área Inválida',
        detail: 'El área especificada no existe o se encuentra inactiva.',
    });
}

/**
 * Verifica si un cargo está activo en la base de datos.
 * @param prisma - Instancia del servicio Prisma para acceder a la base de datos.
 * @param cargoId - ID del cargo a verificar.
 * @param cargoActualId - ID del cargo actual (opcional).
 * @throws NotFoundException si el cargo no existe o está inactivo.
 */
export async function verificarCargoActivo(prisma: PrismaService, cargoId?: string, cargoActualId?: string): Promise<void> {
    //Si no se proporciona un ID de cargo o si coincide con el ID del cargo actual, no se realiza ninguna verificación.
    if (!cargoId || cargoId === cargoActualId) return;

    //Busca el cargo en la base de datos utilizando el ID proporcionado y verifica si está activo.
    const cargo = await prisma.cargo.findUnique({
        where: { id: cargoId, deleted_at: null },
        select: { id: true, activo: true },
    });

    //Si el cargo no existe o está inactivo, lanza una excepción NotFoundException con un mensaje detallado.
    if (!cargo || !cargo.activo) throw new NotFoundException({
        title: 'Cargo Inválido',
        detail: 'El cargo especificado no existe o se encuentra inactivo.'
    });
}

/**
 * Verifica si una jornada de trabajo está activa en la base de datos.
 * @param prisma - Instancia del servicio Prisma para acceder a la base de datos.
 * @param jornadaId - ID de la jornada a verificar.
 * @param jornadaActualId - ID de la jornada actual (opcional).
 * @returns - Una promesa que se resuelve si la jornada es válida y activa, o lanza una excepción si no lo es.
 * @throws BadRequestException si la jornada no existe o está inactiva.
 */
export async function verificarJornadaActiva( prisma: PrismaService, jornadaId?: string | null, jornadaActualId?: string | null ): Promise<void> {
    //Si no se proporciona un ID de jornada o si coincide con el ID de la jornada actual, no se realiza ninguna verificación.
    if (!jornadaId || jornadaId === jornadaActualId) return;

    //Busca la jornada en la base de datos utilizando el ID proporcionado y verifica si está activa.
    const jornada = await prisma.jornada.findUnique({
        where: { id: jornadaId, deleted_at: null },
        select: { id: true, activo: true },
    });

    //Si la jornada no existe o está inactiva, lanza una excepción BadRequestException con un mensaje detallado.
    if (!jornada || !jornada.activo) throw new BadRequestException({
        title: 'Jornada Inválida',
        detail: 'La jornada de trabajo no existe o se encuentra inactiva.',
    });
}

/**
 * Verifica si un número de documento es único en la base de datos.
 * @param prisma - Instancia del servicio Prisma para acceder a la base de datos.
 * @param nroDocumento - Número de documento a verificar.
 * @param empleadoIdExcluir - ID del empleado a excluir de la verificación (opcional).
 * @throws BadRequestException si el número de documento ya pertenece a otro colaborador.
 */
export async function verificarDocumentoUnico(prisma: PrismaService, nroDocumento?: string, empleadoIdExcluir?: string): Promise<void> {
    //Si no se proporciona un número de documento, no se realiza ninguna verificación.
    if (!nroDocumento) return;

    //Busca un empleado con el mismo número de documento, excluyendo al empleado actual si se proporciona un ID.
    const duplicado = await prisma.empleados.findFirst({
        where: {
            nro_documento: nroDocumento.trim(),
            ...(empleadoIdExcluir ? { id: { not: empleadoIdExcluir } } : {}),
            deleted_at: null,
        },
        select: { id: true },
    });

    //Si se encuentra un empleado con el mismo número de documento, lanza una excepción indicando que el documento es duplicado.
    if (duplicado) throw new BadRequestException({
        title: 'Documento Duplicado',
        detail: `El documento '${nroDocumento.trim()}' ya pertenece a otro colaborador.`,
    });
}

/**
 * Valida que no exista otra área registrada con el mismo nombre (insensible a mayúsculas/minúsculas).
 * @param prisma - Instancia del servicio Prisma.
 * @param nombre - Nombre del área a validar.
 * @param areaIdExcluir - UUID del área a excluir en caso de actualización.
 */
export async function verificarNombreAreaUnico(prisma: PrismaService, nombre?: string | null, areaIdExcluir?: string): Promise<void> {
    //Si no se proporciona un nombre de área, no se realiza ninguna verificación.
    if (!nombre) return;
    const limpio = nombre.trim();

    //Busca un área con el mismo nombre (insensible a mayúsculas/minúsculas), excluyendo el área actual si se proporciona un ID.
    const colision = await prisma.area.findFirst({
        where: {
            nombre: { equals: limpio, mode: 'insensitive' },
            ...(areaIdExcluir ? { id: { not: areaIdExcluir } } : {}),
            deleted_at: null,
        },
        select: { id: true },
    });

    //Si se encuentra un área con el mismo nombre, lanza una excepción indicando que el nombre del área es duplicado.
    if (colision) throw new BadRequestException({
        title: 'Área Duplicada',
        detail: `Ya existe un área registrada con el nombre '${limpio}'.`,
    });
}
