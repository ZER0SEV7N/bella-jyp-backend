//src/modules/RRHH/organizacion/use-cases/cargos/helpers/validaciones.helper.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Metodo privado para obtener un cargo por su ID y validar su existencia.
 * @param prisma - Instancia del servicio Prisma para interactuar con la base de datos.
 * @param id - El UUID del cargo a obtener.
 * @returns Una promesa que resuelve con el cargo encontrado.
 * @throws NotFoundException si el cargo no existe o ha sido eliminado.
 */
export async function obtenerCargo(prisma: PrismaService, id: string) {
    const cargo = await prisma.cargo.findUnique({ where: { id, deleted_at: null } });

    //Si el cargo no existe o ha sido eliminado, lanzar una excepción de no encontrado
    if (!cargo) throw new NotFoundException({
        title: 'Cargo no encontrado',
        detail: 'El cargo que intenta actualizar no existe o ha sido eliminado.'
    });
    
    return cargo;
}

/**
 * Método privado para validar que el área de destino exista y esté activa antes de actualizar un cargo.
 * @param prisma - Instancia del servicio Prisma para interactuar con la base de datos.
 * @param idArea - El ID del área de destino a validar.
 * @param idAreaActual - El ID del área actual del cargo.
 * @returns - Una promesa que se resuelve si el área de destino es válida.
 * @throws BadRequestException si el área de destino no existe o está inactiva.
 */
export async function validarAreaActiva(
  prisma: PrismaService,
  idArea: string | undefined,
  idAreaActual?: string,
  esActualizacion = false,
) {
  if (!idArea || idArea === idAreaActual) return;

  const area = await prisma.area.findUnique({
    where: { id: idArea, deleted_at: null },
  });

  if (!area || !area.activo) {
    if (esActualizacion) 
      throw new BadRequestException({
        title: 'Área destino inválida',
        detail: 'El área a la que intenta mover el cargo no existe o está inactiva.',
      });
    

    throw new NotFoundException({
      title: 'Área inválida',
      detail: 'El área especificada no existe o se encuentra inactiva/eliminada.',
    });
  }
}

/**
 * Método privado para validar que no exista otro cargo con el mismo nombre en la misma área.
 * @param prisma - Instancia del servicio Prisma para interactuar con la base de datos.
 * @param id - El ID del cargo que se está actualizando (para excluirlo de la búsqueda).
 * @param nombre - El nombre del cargo que se desea validar.
 * @param idArea - El ID del área en la que se desea validar el nombre del cargo.
 * @returns - Una promesa que se resuelve si el nombre es único en el área.
 * @throws BadRequestException si ya existe otro cargo con el mismo nombre en la misma área.
 */
export async function validarNombreUnico(prisma: PrismaService,nombre: string, idArea: string, idCargoExcluir?: string) {
    const colision = await prisma.cargo.findFirst({
        where: {
            nombre: { equals: nombre, mode: 'insensitive' },
            id_area: idArea,
            ...(idCargoExcluir ? { id: { not: idCargoExcluir } } : {}),
            deleted_at: null
        }
    });

    if (colision) throw new BadRequestException({
        title: 'Nombre de cargo duplicado',
        detail: `Ya existe otro cargo llamado '${nombre}' en el área destino.`
    });
}

  /**
   * Método privado para validar la consistencia de la banda salarial.
   * @param minimo - El sueldo mínimo del cargo.
   * @param maximo - El sueldo máximo del cargo.
   * @throws BadRequestException si el sueldo máximo es menor al sueldo mínimo.
   */
export function validarBandaSalarial(minimo: number | null, maximo: number | null) {
    if (minimo != null && maximo != null && Number(maximo) < Number(minimo)) throw new BadRequestException({
        title: 'Banda Salarial Inconsistente',
        detail: `El sueldo máximo (${maximo}) no puede ser menor al sueldo mínimo (${minimo}).`
    });
}

/**
 * Método privado para obtener el valor del sueldo a utilizar en la validación de la banda salarial.
 * @param payloadValue - El valor del sueldo proporcionado en el payload (puede ser undefined).
 * @param currentValue - El valor actual del sueldo en la base de datos (puede ser null).
 * @returns - El valor del sueldo a utilizar en la validación (puede ser null).
 * 
 */
export function resolverSueldo(payloadValue: number | undefined, currentValue: unknown) {
    if (payloadValue !== undefined) return payloadValue;
    return currentValue !== null ? Number(currentValue) : null;
}