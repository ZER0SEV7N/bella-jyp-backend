//src/modules/afp/use-cases/agregarComision.useCase.ts
import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearComisionDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para agregar una nueva comisión de AFP.
 * Tiene como objetivo validar que el tipo de AFP exista y crear una nueva comisión en la base de datos.
 * @param dto - Objeto de transferencia de datos que contiene la información de la nueva comisión a crear.
 * @returns Una promesa que resuelve con la nueva comisión creada.
 */
@Injectable()
export class AgregarComisionUseCase {
  constructor(private readonly prisma: PrismaService) {}
  
  /**
   * Ejecuta el caso de uso para agregar una nueva comisión de AFP.
   * @param dto - Objeto de transferencia de datos que contiene la información de la nueva comisión a crear.
   * @returns Una promesa que resuelve con la nueva comisión creada.
   */
  async execute(dto: CrearComisionDto) {
    try {
      //validar que el tipo de afp exista
      const tipo_afp = await this.prisma.tipo_afp.findUnique({where: { id: dto.tipo_afp_id }});
      //validar si es valido
      if (!tipo_afp) throw new NotFoundException({
        title: 'AFP no encontrada',
        detail: 'La AFP seleccionada no existe en el sistema.'
      });

      //Preparar las transacciones a realizar en la base de datos
      const transacciones = [];

      //En caso de que se haya proporcionado una comisión anterior, actualizar su periodo_final
      if (dto.anterior_comision?.periodo_final) {
        transacciones.push(
          this.prisma.comisiones_afp.update({
            where: { id: dto.anterior_comision.id },
            //Zod validó que sea string, Prisma exige Date, así que lo convertimos
            data: {periodo_final: new Date(dto.anterior_comision.periodo_final)}
          })
        );
      }

      //Crear la nueva comisión (extrayendo los datos de nueva_comision)
      transacciones.push(
        this.prisma.comisiones_afp.create({
          data: {
            id: IdentityGenerator.generateId(),
            afp_id: dto.tipo_afp_id, //Mapeamos el ID raíz
            periodo_inicio: new Date(dto.nueva_comision.periodo_inicio),
            aporte_obligatorio: dto.nueva_comision.aporte_obligatorio,
            comision_sobre_ra: dto.nueva_comision.comision_sobre_ra,
            prima_seguro: dto.nueva_comision.prima_seguro,
            comision_mixta: dto.nueva_comision.comision_mixta,
          }
        })
      );

      //Ejecutar todo de forma atómica (ACID)
      //Si falla la actualización, tampoco se inserta la nueva
      const resultados = await this.prisma.$transaction(transacciones);

      //Retornar la nueva comisión (que siempre será el último elemento del array)
      return resultados[resultados.length - 1];
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException)
        throw error;

      let errorMessage: string;
      if (error instanceof Error) 
        errorMessage = error.message;
      else if (typeof error === 'string') 
        errorMessage = error;
      else 
        errorMessage = JSON.stringify(error);

      throw new InternalServerErrorException('Ocurrió un error al intentar registrar la comisión de la AFP', errorMessage);
    }
  }
}
