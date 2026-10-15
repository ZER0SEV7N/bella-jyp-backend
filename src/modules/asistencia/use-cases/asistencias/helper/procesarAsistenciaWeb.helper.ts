//src/modules/asistencia/use-cases/asistencias/helper/procesarAsistenciaWeb.helper.ts
//LIBRERIAS
import { PrismaService } from "@/common/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";
import type { tipo_marcacion_enum } from '@prisma/client';

/**
 * Funciona para obtener un colaborador de la base de datos a partir de su número de documento.
 * @param prisma - Instancia del servicio Prisma para interactuar con la base de datos.
 * @param nroDocumento - Número de documento del colaborador que se desea obtener.
 * @returns - Una promesa que resuelve con el objeto del colaborador encontrado en la base de datos.
 * @throws NotFoundException - Si no se encuentra el colaborador en la base de datos.
 */
export async function obtenerColaborador(prisma: PrismaService, nroDocumento: string){
    //Buscar el colaborador en la base de datos por su número de documento, asegurándose de que esté activo y no eliminado.
    const empleado = await prisma.empleados.findFirst({
        where: {
            nro_documento: nroDocumento,
            activo: true,
            deleted_at: null
        },
        select: { id: true }
    });

    if (!empleado) throw new NotFoundException("Empleado no encontrado o inactivo");
    
    return empleado;
}


/**
 * Funcion para validar si ya existe una marcación para un empleado en una fecha y tipo de marcación específicos.
 * @param prisma - Instancia del servicio Prisma para interactuar con la base de datos.
 * @param empleadoId - ID del empleado para el cual se está verificando la existencia de la marcación.
 * @param fecha - Fecha y hora de la marcación que se desea verificar.
 * @param tipo - Tipo de marcación (entrada, salida, etc.) que se desea verificar.
 * @returns - Una promesa que resuelve con un valor booleano indicando si ya existe una marcación para el empleado en la fecha y tipo especificados.
 * @throws NotFoundException - Si no se encuentra el empleado en la base de datos.
 * @throws Error - Si ocurre algún error al interactuar con la base de datos.
 */
export async function validarExistencia(prisma: PrismaService, empleadoId: string, fecha: Date, tipo: tipo_marcacion_enum): Promise<boolean> {
    const registro = await prisma.asistencia_marcacion.findFirst({
        where: {
            empleado_id: empleadoId,
            fecha_hora: fecha,
            tipo_marcacion: tipo
        },
        select: { id: true }
    });

    return registro !== null;
}