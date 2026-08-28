//src/modules/afp/use-cases/tipo-afp/agregarTipoAfp.useCase.ts
import {BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { CrearTipoAfpDto } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';

/**
 * Caso de uso para agregar un nuevo tipo de AFP.
 * Este caso de uso se encarga de validar y crear un nuevo tipo de AFP en la base de datos.
 * Se asegura de que el régimen de pensión exista y corresponda a un sistema AFP, y que no haya duplicados
 * en el nombre del tipo de AFP. Si la validación es exitosa, se persiste el nuevo tipo de AFP en la base de datos.
 * 
 * @param dto - Objeto que contiene la información del nuevo tipo de AFP a crear.
 */
@Injectable()
export class AgregarTipoAfpUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para agregar un nuevo tipo de AFP.
   * @param dto - Objeto que contiene la información del nuevo tipo de AFP a crear.
   * @returns Una promesa que resuelve con el nuevo tipo de AFP creado.
   */
  async execute(dto: CrearTipoAfpDto) {
    try {
      //Validar que el régimen de pensión exista y sea un sistema AFP
      const regimen = await this.prisma.regimen_pension.findUnique({
        where: { id: dto.id_regimen },
        select: { id: true, nombre: true }
      });

      //Validar si el régimen de pensión es válido y corresponde a un sistema AFP
      if (!regimen?.nombre.includes('AFP'))
        throw new BadRequestException({
          title: 'Régimen Inválido',
          detail: 'El régimen de pensión seleccionado no existe o no corresponde a un sistema AFP.'
        });

      //Validar que no se duplique el nombre del tipo de AFP
      const afpExistente = await this.prisma.tipo_afp.findFirst({where: { nombre: dto.nombre }});

      //Si ya existe un tipo de AFP con el mismo nombre, lanzar una excepción
      if (afpExistente) throw new BadRequestException({
        title: 'AFP Duplicada',
        detail: `Ya existe una AFP registrada con el nombre '${dto.nombre}'.`
      });

      //Crear un nuevo tipo de AFP en la base de datos
      const nuevoTipo = await this.prisma.tipo_afp.create({data: { id: IdentityGenerator.generateId(), ...dto }});
      return nuevoTipo;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException)
        throw error;

      let errorDetail: string;

      if (error instanceof Error) 
        errorDetail = error.message;
      else if (typeof error === 'string') 
        errorDetail = error;
      else 
        errorDetail = JSON.stringify(error);

      throw new InternalServerErrorException('Ocurrió un error al intentar registrar la nueva AFP', errorDetail);
    }
  }
}
