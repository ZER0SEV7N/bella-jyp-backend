//src/modules/RRHH/use-cases/cargos/activeCargo.useCase.ts
//Caso de uso para activar un cargo en el módulo de RRHH
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import { z } from 'zod';

//Caso de uso
@Injectable()
export class ActiveCargoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(idCargo: string) {
<<<<<<< HEAD
    const idValidado = z.string().uuid().parse(idCargo);

=======
    //Validar que el ID proporcionado sea un UUID válido
    const idValidado = z.uuid().parse(idCargo);
    
>>>>>>> feature/soporte
    try {
      const data = await this.prisma.cargo.update({
        where: {
          id: idValidado,
        },
        data: {
          activo: true,
          deleted_at: null, //Limpiar la fecha de eliminación para restaurar el cargo
        },
      });

      return {
        state: true,
        message: 'Cargo restaurado/activado correctamente',
        data: data,
      };
    } catch (error) {
      throw new BadRequestException({
        title: 'Error al activar el cargo',
        detail:
          'No se pudo realizar la operación, asegúrate de que el ID sea correcto.',
      });
    }
  }
}
