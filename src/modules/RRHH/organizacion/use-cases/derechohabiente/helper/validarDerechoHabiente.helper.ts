//src/modules/RRHH/organizacion/use-cases/derechohabiente/helper/validarDerechoHabiente.helper.ts
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import dayjs from 'dayjs';

/**
 * Metodo para validar si el empleado titular de un derechohabiente existe y es válido.
 * @param prisma Instancia del servicio de Prisma para interactuar con la base de datos.
 * @param empleadoId ID del empleado titular a validar.
 * @throws NotFoundException si el empleado no existe.
 * @throws BadRequestException si el empleado no es válido.
 * @throws ConflictException si el empleado tiene un estado de baja o inactivo.
 */
export async function validarEmpleadoTitular(prisma: PrismaService, empleadoId: string) {
    const empleado = await prisma.empleados.findUnique({
        where: { id: empleadoId, deleted_at: null},
        select: { id: true, activo: true, asig_familiar: true } 
    });
 
    if(!empleado || !empleado.activo) throw new NotFoundException({
        title: 'Colaborador Titular Inválido',
        detail: 'El colaborador titular no existe, ha sido cesado o está inactivo.'
    });

    return empleado;
}

/**
 * Metodo para validar si el documento de un derechohabiente es único dentro del contexto del empleado titular.
 * @param prisma Instancia del servicio de Prisma para interactuar con la base de datos.
 * @param empleadoId ID del empleado titular asociado al derechohabiente.
 * @param nroDocumento Número de documento del derechohabiente a validar.
 * @param derechoHabienteId (Opcional) ID del derechohabiente a excluir de la validación (útil para actualizaciones).
 * @throws ConflictException si el documento ya está registrado para otro derechohabiente del mismo empleado titular.
 */
export async function validarDocumentoDerechoHabiente(prisma: PrismaService, empleadoId: string, nroDocumento: string, derechoHabienteId?: string): Promise<void> {
    const documentoLimpio = nroDocumento.trim()

    const duplicado = await prisma.derechohabientes.findFirst({
        where : {
            empleado_id: empleadoId,
            nro_documento: documentoLimpio,
            ...(derechoHabienteId ? { id: { not: derechoHabienteId } } : {}), //Excluir el derechohabiente actual si se proporciona un ID (útil para actualizaciones)
            deleted_at: null
        },
        select: { id: true }
    });

    if(duplicado) throw new ConflictException({
        title: 'Derechohabiente Duplicado',
        detail: `El familiar con documento '${documentoLimpio}' ya se encuentra registrado para este colaborador.`,
    });
}

/**
 * Metodo para validar la edad de un derechohabiente según su vínculo con el empleado titular.
 * @param vinculo - Vínculo del derechohabiente con el empleado titular (por ejemplo, 'HIJO_MENOR', 'HIJO_MAYOR_ESTUDIANTE', 'HIJO_MAYOR_INCAPACITADO').
 * @param fechaNacimiento - Fecha de nacimiento del derechohabiente a validar.
 * @throws BadRequestException si la fecha de nacimiento es futura o si la edad no cumple con las restricciones del vínculo especificado.
 */
export function validarEdadSegunVinculo(vinculo: string, fechaNacimiento: Date): void {
    const edad = dayjs().diff(dayjs(fechaNacimiento), 'year');

    if (edad < 0) throw new BadRequestException({
        title: 'Fecha de Nacimiento Inválida',
        detail: 'La fecha de nacimiento no puede ser futura.',
    });
  
    if (vinculo === 'HIJO_MENOR' && edad >= 18) throw new BadRequestException({
        title: 'Inconsistencia de Edad',
        detail: `Un hijo menor de edad debe tener menos de 18 años (edad calculada: ${edad} años).`,
    });
  

    if (vinculo === 'HIJO_MAYOR_ESTUDIANTE' && (edad < 18 || edad > 28)) throw new BadRequestException({
        title: 'Inconsistencia de Edad',
        detail: `Un hijo mayor estudiante debe tener entre 18 y 28 años cumplidos (edad calculada: ${edad} años).`
    });
  

    if (vinculo === 'HIJO_MAYOR_INCAPACITADO' && edad < 18) throw new BadRequestException({
        title: 'Inconsistencia de Edad',
        detail: `La figura de hijo mayor incapacitado aplica a partir de los 18 años (edad calculada: ${edad} años).`,
    });
  
}