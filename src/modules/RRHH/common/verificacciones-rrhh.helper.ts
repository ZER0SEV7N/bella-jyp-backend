//src/modules/RRHH/common/verificacciones-rrhh.helper.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

export async function verificarAreaActiva(prisma: PrismaService, areaId?: string, areaActualId?: string): Promise<void> {
    if (!areaId || areaId === areaActualId) return;

    const area = await prisma.area.findUnique({
        where: { id: areaId, deleted_at: null },
        select: { id: true, activo: true }
    });

    if (!area || !area.activo) throw new NotFoundException({
        title: 'Área Inválida',
        detail: 'El área especificada no existe o se encuentra inactiva.'
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
    if (!cargoId || cargoId === cargoActualId) return;

    const cargo = await prisma.cargo.findUnique({
        where: { id: cargoId, deleted_at: null },
        select: { id: true, activo: true }
    });

    if (!cargo || !cargo.activo) throw new NotFoundException({
        title: 'Cargo Inválido',
        detail: 'El cargo especificado no existe o se encuentra inactivo.'
    });
    
}

export async function verificarJornadaActiva(prisma: PrismaService, jornadaId?: string | null, jornadaActualId?: string | null): Promise<void> {
    if (!jornadaId || jornadaId === jornadaActualId) return;

    const jornada = await prisma.jornada.findUnique({
        where: { id: jornadaId, deleted_at: null },
        select: { id: true, activo: true },
    });

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
    if (!nroDocumento) return;

    const duplicado = await prisma.empleados.findFirst({
        where: {
            nro_documento: nroDocumento.trim(),
            ...(empleadoIdExcluir ? { id: { not: empleadoIdExcluir } } : {}),
            deleted_at: null
        },
        select: { id: true }
    });

    if (duplicado) 
        throw new BadRequestException({
        title: 'Documento Duplicado',
        detail: `El documento '${nroDocumento.trim()}' ya pertenece a otro colaborador.`
    });
}


/**
 * Valida que no exista otra área registrada con el mismo nombre (insensible a mayúsculas/minúsculas).
 * @param prisma - Instancia del servicio Prisma.
 * @param nombre - Nombre del área a validar.
 * @param areaIdExcluir - UUID del área a excluir en caso de actualización.
 */
export async function verificarNombreAreaUnico( prisma: PrismaService, nombre?: string | null, areaIdExcluir?: string ): Promise<void> {
    if (!nombre) return;
    const limpio = nombre.trim();

    const colision = await prisma.area.findFirst({
        where: {
            nombre: { equals: limpio, mode: 'insensitive' },
            ...(areaIdExcluir ? { id: { not: areaIdExcluir } } : {}),
            deleted_at: null
        },
        select: { id: true }
    });

    if (colision) throw new BadRequestException({
        title: 'Área Duplicada',
        detail: `Ya existe un área registrada con el nombre '${limpio}'.`
    }); 
}