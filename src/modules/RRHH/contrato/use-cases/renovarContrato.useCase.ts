//src/modules/RRHH/contrato/use-cases/renovarContrato.useCase.ts
import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { RenovarContratoDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para renovar un contrato en el módulo de RRHH
 * Contiene la lógica de negocio para renovar un contrato en la base de datos utilizando Prisma.
 * Se encarga de recibir el ID del contrato a renovar y los datos del nuevo contrato, validar la existencia del contrato y del empleado, y crear un nuevo contrato asociado al mismo empleado.
 * En caso de error, lanza una excepción interna del servidor con un mensaje descriptivo.
 */
@Injectable()
export class RenovarContratoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea un nuevo contrato como renovación del contrato existente
   * Regla de negocio: No se permite renovar un contrato si el empleado asociado está cesado.
   * @param idViejoContrato  El ID del contrato que se va a renovar
   * @param dto Los datos del nuevo contrato a crear
   * @returns Una promesa que resuelve con el nuevo contrato creado
   * @throws NotFoundException si el contrato a renovar no existe o ha sido eliminado
   */
  async execute(idViejoContrato: string, dto: RenovarContratoDto) {
    //Buscar el contrato existente para validar su existencia y obtener el empleado asociado
    const contratoViejo = await this.prisma.contratos.findUnique({
      where: { id: idViejoContrato },
      include: { empleados: { select: { activo: true } } }
    });
    
    //Validar que el contrato a renovar exista y no haya sido eliminado
    if (!contratoViejo || contratoViejo.deleted_at !== null) throw new NotFoundException('El contrato a renovar no fue encontrado.');
    
    if (!contratoViejo.empleados?.activo) throw new BadRequestException('No se puede crear un contrato de renovación para un empleado cesado.');

    //Transaccion ACID para actualizar el contrato viejo y crear el nuevo contrato de renovación
    try {
      const resultados = await this.prisma.$transaction([
        this.prisma.contratos.update({
          where: { id: idViejoContrato },
          data: { renovado: true },
        }),
        
        this.prisma.contratos.create({
          data: {
            id: IdentityGenerator.generateId(),
            empleado_id: contratoViejo.empleado_id, // Mantenemos al mismo empleado
            id_estado: dto.id_estado,
            url: '',
            tipo_modalidad: dto.tipo_modalidad || contratoViejo.tipo_modalidad,
            fecha_inicio: new Date(dto.fecha_inicio),
            fecha_fin: dto.fecha_fin ? new Date(dto.fecha_fin) : null,
            observacion: dto.observacion || `Renovación del contrato ${idViejoContrato}`,
            renovado: false
          }
        })
      ]);

      //Devolvemos el nuevo contrato creado como resultado de la transacción
      return resultados[1];
    } catch (error) {
      throw new InternalServerErrorException('Error al procesar la renovación del contrato.', error instanceof Error ? error.message : String(error));
    }
  }
}