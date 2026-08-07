//src/modules/afp/use-cases/tipo-afp/agregarTipoAfp.useCase.ts
import {BadRequestException, Injectable, InternalServerErrorException, NotFoundException} from '@nestjs/common';
import {PrismaService } from '@/common/prisma/prisma.service';
import type {CrearTipoAfpDto } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';

/**
 * Caso de uso para agregar un nuevo tipo de AFP.
 * Tiene como objetivo validar que el régimen de pensión sea válido y crear un nuevo tipo de AFP en la base de datos.
 * 
 * @param dto - Objeto de transferencia de datos que contiene la información del nuevo tipo de AFP a crear.
 */
@Injectable()
export class AgregarTipoAfpUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(dto: CrearTipoAfpDto) {
    try {
      //Validar que el régimen de pensión exista y sea un sistema AFP
      const regimen = await this.prisma.regimen_pension.findUnique({
        where: {id: dto.id_regimen},
        select: {id: true, nombre: true}
      });
      
      //Validar si el régimen de pensión es válido y corresponde a un sistema AFP
      if (!regimen || !regimen.nombre.includes('AFP')) throw new BadRequestException({
        title: 'Régimen Inválido',
        detail: 'El régimen de pensión seleccionado no existe o no corresponde a un sistema AFP.',
      });
      
      //Validar que no se duplique el nombre del tipo de AFP
      const afpExistente = await this.prisma.tipo_afp.findFirst({where: { nombre: dto.nombre }});

      //Si ya existe un tipo de AFP con el mismo nombre, lanzar una excepción
      if (afpExistente) throw new BadRequestException({
        title: 'AFP Duplicada',
        detail: `Ya existe una AFP registrada con el nombre '${dto.nombre}'.`,
      });
      
      //Crear un nuevo tipo de AFP en la base de datos
      const nuevoTipo = await this.prisma.tipo_afp.create({data: { id: IdentityGenerator.generateId(), ...dto }});
      return nuevoTipo;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      
      throw new InternalServerErrorException(
        'Ocurrió un error al intentar registrar la nueva AFP',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
