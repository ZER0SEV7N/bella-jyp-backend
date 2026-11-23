//src/modules/RRHH/datoFinanciero/use-case/helper/validacionesDatoFinanciero.helper.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Helper para validar la existencia de entidades financieras en la base de datos utilizando Prisma.
 * Este helper se utiliza en los casos de uso relacionados con la gestión de datos financieros, como la creación o actualización de registros que dependen de entidades financieras.
 */

/**
 * Valida la existencia de entidades financieras en la base de datos utilizando Prisma.
 * @param prisma - Instancia del servicio Prisma para interactuar con la base de datos.
 * @param ids - Objeto que contiene los identificadores de las entidades financieras a validar.
 * @throws NotFoundException si alguna de las entidades no existe en la base de datos.
 * @returns Promise<void> - Una promesa que se resuelve si todas las entidades existen, o se rechaza con una excepción si alguna no existe.
 */
export async function validarEntidadesFinancieras(
  prisma: PrismaService,
  ids: {
    id_regimen?: string;
    id_tipo_afp?: string | null;
    id_banco_sueldo?: string | null;
    id_banco_cts?: string | null;
  }
): Promise<void> {
  //Crear un array de promesas para validar cada entidad de forma concurrente
  const promesas: Promise<any>[] = [];

  //Validar existencia de régimen de pensión, tipo de AFP y bancos si se proporcionan
  if (ids.id_regimen)
    promesas.push(
      prisma.regimen_pension
        .findUnique({ where: { id: ids.id_regimen } })
        .then((regimen) => {
          if (!regimen)
            throw new NotFoundException(
              'El régimen de pensión especificado no existe.'
            );
        })
    );

  //Validar existencia de tipo de AFP si se proporciona
  if (ids.id_tipo_afp)
    promesas.push(
      prisma.tipo_afp
        .findUnique({ where: { id: ids.id_tipo_afp } })
        .then((afp) => {
          if (!afp)
            throw new NotFoundException(
              'El tipo de AFP especificado no existe.'
            );
        })
    );

  //Validar existencia de bancos si se proporcionan
  if (ids.id_banco_sueldo)
    promesas.push(
      prisma.bancos
        .findUnique({ where: { id: ids.id_banco_sueldo } })
        .then((banco) => {
          if (!banco)
            throw new NotFoundException(
              'El banco para abono de sueldo no existe.'
            );
        })
    );

  //Validar existencia de banco CTS si se proporciona
  if (ids.id_banco_cts)
    promesas.push(
      prisma.bancos
        .findUnique({ where: { id: ids.id_banco_cts } })
        .then((banco) => {
          if (!banco)
            throw new NotFoundException(
              'El banco para depósito de CTS no existe.'
            );
        })
    );

  await Promise.all(promesas);
}
/**
 * Valida que el sueldo básico esté dentro del rango salarial permitido por el cargo (ORG-M1).
 *
 * @param prisma - Instancia del servicio Prisma para consultar el cargo.
 * @param idCargo - ID del cargo asignado al colaborador.
 * @param sueldoBasico - Sueldo básico a validar.
 * @throws {BadRequestException} Si el sueldo no es mayor a 0 o está fuera del rango del cargo.
 * @throws {NotFoundException} Si el cargo no existe o se encuentra inactivo.
 */
export async function validarSueldoCargo(
  prisma: PrismaService,
  idCargo: string,
  sueldoBasico: number
): Promise<void> {
  if (!Number.isFinite(sueldoBasico) || sueldoBasico <= 0) {
    throw new BadRequestException({
      title: 'Sueldo inválido',
      detail: 'El sueldo básico debe ser un número mayor a 0.',
      campo: 'sueldo_basico',
    });
  }

  const sueldo = new Prisma.Decimal(sueldoBasico);
  const cargoSueldo = await prisma.cargo.findFirst({
    where: {
      id: idCargo,
      deleted_at: null,
      activo: true,
    },
    select: {
      sueldo_maximo: true,
      sueldo_minimo: true,
    },
  });

  if (!cargoSueldo) {
    throw new NotFoundException({
      title: 'Cargo no encontrado',
      detail: `El cargo con ID '${idCargo}' no existe o se encuentra inactivo.`,
    });
  }

  const { sueldo_minimo: sueldoMinimo, sueldo_maximo: sueldoMaximo } =
    cargoSueldo;
  const debajoDelMinimo = sueldoMinimo != null && sueldo.lt(sueldoMinimo);
  const encimaDelMaximo = sueldoMaximo != null && sueldo.gt(sueldoMaximo);

  if (debajoDelMinimo || encimaDelMaximo) {
    let detail: string;
    if (sueldoMinimo != null && sueldoMaximo != null) {
      detail = `El sueldo debe estar entre S/ ${Number(sueldoMinimo)} y S/ ${Number(sueldoMaximo)} para este cargo.`;
    } else if (sueldoMinimo != null) {
      detail = `El sueldo debe ser al menos S/ ${Number(sueldoMinimo)} para este cargo.`;
    } else {
      detail = `El sueldo no debe superar S/ ${Number(sueldoMaximo)} para este cargo.`;
    }

    throw new BadRequestException({
      title: 'Sueldo fuera de rango',
      detail,
      campo: 'sueldo_basico',
    });
  }
}
