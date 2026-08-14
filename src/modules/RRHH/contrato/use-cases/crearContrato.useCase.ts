//src/modules/RRHH/contrato/use-cases/crearContrato.useCase.ts
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CrearContratoDto } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';

/**
 * Caso de uso para crear un contrato en el módulo de RRHH
 * Contiene la lógica de negocio para crear un contrato en la base de datos utilizando Prisma.
 * Se encarga de recibir los datos del contrato, generar un UUID único y almacenar la información en la base de datos.
 * En caso de error, lanza una excepción interna del servidor con un mensaje descriptivo.
 */
@Injectable()
export class CrearContratoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  
  /**
   * Ejecuta el caso de uso para crear un contrato
   * @param datosContrato Los datos del contrato a crear
   * @param URL La URL del contrato
   * @returns Una promesa que resuelve con el contrato creado
   */
  async execute(datosContrato: CrearContratoDto, URL?: string) {
    try {
      //Validar que el empleado exista y esté activo
      const empleado = await this.prisma.empleados.findUnique({ where: {id: datosContrato.empleado_id} });

      if(!empleado || !empleado.activo || empleado.deleted_at !== null) throw new NotFoundException({
        title: 'Empleado no encontrado',
        message: 'No se encontró un empleado activo con el ID proporcionado'
      });

      //Validar el estado del contrato
      const estado = await this.prisma.estado_contrato.findUnique({ where: {id: datosContrato.id_estado} });
      if (!estado) throw new NotFoundException('El estado de contrato especificado no existe en el catálogo.');
      
      //Crear el contrato en la base de datos
      const contrato = await this.prisma.contratos.create({
        data: {
          id: IdentityGenerator.generateId(),
          url: URL || null,
          ...datosContrato,
          fecha_inicio: new Date(datosContrato.fecha_inicio),
          fecha_fin: datosContrato.fecha_fin ? new Date(datosContrato.fecha_fin) : null,
        }
      });

      return contrato;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;

      throw new InternalServerErrorException('Ocurrió un error al intentar registrar el contrato.', error instanceof Error ? error.message : String(error));
    }
  }
}
