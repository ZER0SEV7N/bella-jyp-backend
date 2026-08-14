//src/modules/RRHH/contrato/use-cases/anularContrato.useCase.ts
import {Injectable,NotFoundException, InternalServerErrorException} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Caso de uso para anular un contrato en el módulo de RRHH
 * Contiene la lógica de negocio para anular un contrato en la base de datos utilizando Prisma.
 * Se encarga de recibir el ID del contrato, validar su existencia y marcarlo como anulado.
 * En caso de error, lanza una excepción interna del servidor con un mensaje descriptivo.
 */
@Injectable()
export class AnularContratoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para anular un contrato por su ID
   * @param idContrato El ID del contrato a anular
   * @returns Una promesa que resuelve con el contrato anulado
   * @throws NotFoundException si el contrato no existe o ya ha sido anulado
   * @throws InternalServerErrorException si ocurre un error al intentar anular el contrato
   */
  async execute(idContrato: string) {
    const contrato = await this.prisma.contratos.findUnique({where: { id: idContrato } });
    
    if (!contrato || contrato.deleted_at !== null) 
      throw new NotFoundException('Contrato no encontrado o ya eliminado.');
    
    try {
      return await this.prisma.contratos.update({
        where: { id: idContrato },
        data: { deleted_at: new Date() }
      });
    } catch (error) {
      throw new InternalServerErrorException('Error al intentar eliminar el contrato.');
    }
  }
}