//src/modules/afp/use-cases/aportacion/agregarAportacion.useCase.ts
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { AportacionDto } from '@jyp/shared-contracts';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';

/**
 * Caso de uso para agregar una nueva aportación de AFP.
 * Tiene como objetivo validar que el tipo de AFP exista y crear una nueva aportación en la base de datos.
 * 
 * @param dto - Objeto de transferencia de datos que contiene la información de la nueva aportación a crear.
 */
@Injectable()
export class AgregarAportacionUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(dto: AportacionDto) {
    try {
      //Validar que el tipo de AFP exista
      const tipo_afp = await this.prisma.tipo_afp.findUnique({where: { id: dto.afp_id } });

      if (!tipo_afp) throw new NotFoundException({
        title: 'AFP no encontrada',
        detail: 'No se puede registrar la aportación porque la AFP seleccionada no existe.',
      });
      
      //Crear la aportación en la base de datos
      const aportacionCreada = await this.prisma.aportaciones.create({
        data: { id: IdentityGenerator.generateId(), ...dto }
      });
      
      return aportacionCreada;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;

      throw new InternalServerErrorException(
        'Ocurrió un error al intentar registrar la aportación',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
