//src/modules/RRHH/organizacion/use-cases/cargos/helpers/validaciones.helper.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Obtiene un cargo por su ID y verifica que exista y no haya sido eliminado.
 * @param prisma - Instancia del servicio Prisma para interactuar con la base de datos.
 * @param id - ID del cargo a buscar.
 * @returns El cargo encontrado si existe y no ha sido eliminado.
 * @throws NotFoundException si el cargo no existe o ha sido eliminado.
 */
export async function obtenerCargo(prisma: PrismaService, id: string) {
  //Buscar el cargo en la base de datos por su ID y verificar que no haya sido eliminado
  const cargo = await prisma.cargo.findUnique({ where: { id, deleted_at: null } });

  //Si no se encuentra el cargo, lanzar una excepción de no encontrado
  if (!cargo) throw new NotFoundException({
    title: 'Cargo no encontrado',
    detail: 'El cargo solicitado no existe o ha sido dado de baja.'
  });

  return cargo;
}

/**
 * Valida que el nombre de un cargo sea único dentro de un área específica.
 * @param prisma - Instancia del servicio Prisma para interactuar con la base de datos.
 * @param nombre - Nombre del cargo a validar.
 * @param idArea - ID del área a la que pertenece el cargo.
 * @param idCargoExcluir - ID del cargo a excluir de la validación (opcional).
 * @throws BadRequestException si ya existe otro cargo con el mismo nombre en el área especificada.
 */
export async function validarNombreCargoUnico(prisma: PrismaService, nombre: string, idArea: string, idCargoExcluir?: string ): Promise<void> {
  //Buscar un cargo con el mismo nombre en el área especificada, excluyendo el cargo actual si se proporciona su ID
  const colision = await prisma.cargo.findFirst({
    where: {
      nombre: { equals: nombre.trim(), mode: 'insensitive' },
      id_area: idArea,
      ...(idCargoExcluir ? { id: { not: idCargoExcluir } } : {}),
      deleted_at: null
    },
    select: { id: true }
  });

  //Si se encuentra un cargo con el mismo nombre, lanzar una excepción de solicitud incorrecta
  if (colision) throw new BadRequestException({
    title: 'Nombre de cargo duplicado',
    detail: `Ya existe otro cargo llamado '${nombre.trim()}' en el área de destino.`
  });
}

/**
 * Valida que la banda salarial de un cargo sea consistente, es decir, que el sueldo máximo no sea inferior al sueldo mínimo.
 * @param minimo - Sueldo mínimo del cargo.
 * @param maximo - Sueldo máximo del cargo.
 * @throws BadRequestException si el sueldo máximo es inferior al sueldo mínimo.
 */
export function validarBandaSalarial(minimo: number | null, maximo: number | null): void {
  if (minimo != null && maximo != null && Number(maximo) < Number(minimo)) throw new BadRequestException({
    title: 'Banda Salarial Inconsistente',
    detail: `El sueldo máximo (${maximo}) no puede ser inferior al sueldo mínimo (${minimo}).`
  });
}

/**
 * Resuelve el valor del sueldo a utilizar, priorizando el valor proporcionado en el payload y, si no está definido, utilizando el valor actual del cargo.
 * @param payloadValue - Valor del sueldo proporcionado en el payload (puede ser undefined).
 * @param currentValue - Valor actual del sueldo del cargo (puede ser null o undefined).
 * @returns El valor del sueldo a utilizar, que puede ser un número o null.
 */
export function resolverSueldo(payloadValue: number | undefined, currentValue: unknown): number | null {
  if (payloadValue !== undefined) return payloadValue;
  return currentValue !== null && currentValue !== undefined ? Number(currentValue) : null;
}