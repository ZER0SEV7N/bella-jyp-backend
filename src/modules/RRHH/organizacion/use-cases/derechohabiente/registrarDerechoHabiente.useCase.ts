//src/modules/RRHH/organizacion/use-cases/derechohabiente/registrarDerechoHabiente.useCase.ts
import { Injectable, BadRequestException, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { sanitizarTexto, sanitizarFecha } from '@/common/utils/transformacion.util';
import type { RegistrarDerechohabienteDto } from '@jyp/shared-contracts';
import { validarEmpleadoTitular, validarDocumentoDerechoHabiente, validarEdadSegunVinculo } from './helper/validarDerechoHabiente.helper';

/**
 * Caso de uso para registrar un derechohabiente asociado a un empleado titular.
 * Este caso de uso valida la existencia y estado del empleado titular, 
 * asegura que el documento del derechohabiente sea único dentro del contexto del empleado, 
 * y verifica que la edad del derechohabiente cumpla con las restricciones según su vínculo.
 */
@Injectable()
export class RegistrarDerechohabienteUseCase {
    constructor(private readonly prisma: PrismaService) {}
    
    /**
     * Metodo principal para ejecutar el caso de uso de registro de derechohabiente.
     * @param dto Objeto de transferencia de datos que contiene la información del derechohabiente a registrar.
     * @throws NotFoundException si el empleado titular no existe o está inactivo.
     */
    async execute(dto: RegistrarDerechohabienteDto) {
        try{
            const titular = await validarEmpleadoTitular(this.prisma, dto.empleado_id);
            await validarDocumentoDerechoHabiente(this.prisma, dto.empleado_id, dto.nro_documento);

            const fechaNac = sanitizarFecha(dto.fecha_nacimiento);
            if(!fechaNac) throw new BadRequestException({
                title: 'Fecha de Nacimiento Inválida',
                detail: 'La fecha de nacimiento proporcionada no es válida o no cumple con el formato esperado.'
            });

            validarEdadSegunVinculo(dto.vinculo, fechaNac);

            const idGenerado = IdentityGenerator.generateId();
            const generaAsignacionFamiliar = dto.vinculo === 'HIJO_MENOR' || dto.vinculo === 'HIJO_MAYOR_ESTUDIANTE'

            return await this.prisma.$transaction(async (tx) => {
                const nuevoDerechoHabiente = await tx.derechohabientes.create({
                    data: {
                        id: idGenerado,
                        empleado_id: dto.empleado_id,
                        documento_id: dto.documento_id,
                        nro_documento: dto.nro_documento.trim(),
                        nombres: sanitizarTexto(dto.nombres)!,
                        apellidos: sanitizarTexto(dto.apellidos)!,
                        vinculo: dto.vinculo,
                        estado_civil: dto.estado_civil,
                        sexo: dto.sexo,
                        fecha_nacimiento: fechaNac,
                        activo: true,
                    },
                    include: {
                        tipo_documento: { select: { id: true, tipo_documento: true } },
                    },
                });

                    // Activación automática de Asignación Familiar (Ley 25129)
                if (generaAsignacionFamiliar && !titular.asig_familiar) await tx.empleados.update({
                    where: { id: dto.empleado_id },
                    data: { asig_familiar: true }
                });

                return nuevoDerechoHabiente;
            });
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException) 
                throw error;
            
            throw new InternalServerErrorException({
                title: 'Error al Registrar Derechohabiente',
                detail: error instanceof Error ? error.message : 'Fallo interno al registrar el derechohabiente.'
            });
        }
    }
}