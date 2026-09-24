//src/modules/RRHH/organizacion/use-cases/empleado/helper/validacionesEmpleado.ts
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ReniecAdapter } from '../../../services/reniec.adapter';
import { verificarAreaActiva, verificarCargoActivo, verificarJornadaActiva } from '@/modules/RRHH/common/verificacciones-rrhh.helper';

/**
 * Interfaz que define los IDs de las referencias de un empleado.
 * Esta interfaz se utiliza para validar las entidades relacionadas con un empleado, 
 * como área, cargo, tipo de documento, estado del empleado y jornada laboral.
 */
export interface ReferenciasEmpleadoIds {
  area_id?: string;
  cargo_id?: string;
  documento_id?: string;
  estado_empleado_id?: string;
  jornada_id?: string | null;
}

/** 
 * Valida que las entidades relacionadas con un empleado existan y estén activas en la base de datos.
 * @param prisma - Instancia del servicio Prisma para acceder a la base de datos.
 * @param ids - Objeto que contiene los IDs de las entidades a validar.
 * @param idsActuales - Objeto que contiene los IDs actuales de las entidades del empleado (opcional).
 * @throws NotFoundException si alguna de las entidades no existe o está inactiva.
 */
export async function validarEntidadesEmpleado(prisma: PrismaService, ids: ReferenciasEmpleadoIds, idsActuales?: { area_id?: string; cargo_id?: string; jornada_id?: string | null }): Promise<void> {
  //Validaciones de área, cargo y jornada laboral utilizando funciones auxiliares.
  const promesas: Promise<any>[] = [
    verificarAreaActiva(prisma, ids.area_id, idsActuales?.area_id),
    verificarCargoActivo(prisma, ids.cargo_id, idsActuales?.cargo_id),
    verificarJornadaActiva(prisma, ids.jornada_id, idsActuales?.jornada_id),
  ];

  //Validación de tipo de documento y estado del empleado directamente con consultas a la base de datos.
  if (ids.documento_id) promesas.push(prisma.tipo_documento.findUnique({ where: { id: ids.documento_id } }).then((tipoDoc) => {
    if (!tipoDoc) throw new NotFoundException({ title: 'Tipo de Documento Inválido', detail: 'El tipo de documento especificado no existe.' });
  }));
  
  //Validación de estado del empleado
  if (ids.estado_empleado_id) promesas.push( prisma.estado_empleado.findUnique({ where: { id: ids.estado_empleado_id } }).then((estado) => {
    if (!estado) throw new NotFoundException({ title: 'Estado Inválido', detail: 'El estado del empleado especificado no existe.' });
  }));
  
  //Ejecutar todas las promesas de validación en paralelo y esperar a que todas se completen.
  await Promise.all(promesas);
}

/**
 * Valida que un número de documento sea único en la base de datos, excluyendo un empleado específico si se proporciona su ID.
 * @param prisma - Instancia del servicio Prisma para acceder a la base de datos.
 * @param nroDocumento - Número de documento a validar.
 * @param empleadoIdExcluir - ID del empleado a excluir de la validación (opcional).
 * @throws BadRequestException si el número de documento ya está registrado para otro empleado.
 */
export async function encontrarIdentidad(reniecAdapter: ReniecAdapter, nroDocumento: string, nombre?: string | null, apellido?: string | null): Promise<{ nombre: string | null; apellido: string | null }> {
  //Limpiar los valores de nombre y apellido, eliminando espacios en blanco y asignando null si están vacíos.
  const nombreLimpio = nombre?.trim() || null;
  const apellidoLimpio = apellido?.trim() || null;

  //Si ya se proporcionan nombre y apellido, o si el número de documento no tiene 8 dígitos, se devuelve la información proporcionada sin consultar a RENIEC.
  if ((nombreLimpio && apellidoLimpio) || nroDocumento.length !== 8) 
    return { nombre: nombreLimpio, apellido: apellidoLimpio };
  
  //Si no se proporcionan nombre y apellido, se consulta a RENIEC para obtener la información del ciudadano.
  try {
    const ciudadano = await reniecAdapter.consultarDni(nroDocumento);
    return {
      nombre: ciudadano.nombre,
      apellido: `${ciudadano.apellido_paterno} ${ciudadano.apellido_materno}`.trim()
    };
  } catch {
    throw new BadRequestException({
      title: 'Fallo de Verificación de Identidad',
      detail: 'No se pudo auto-completar los datos mediante RENIEC. Por favor, ingrese el nombre y apellido manualmente.'
    });
  }
}