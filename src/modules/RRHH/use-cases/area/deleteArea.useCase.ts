import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import { dtoCrearAreaInput, crearAreaSchema } from '@jyp/shared-scontracts';

@Injectable()
export class CrearAreaUseCase { 
    async execute(dto: dtoCrearAreaInput) {
}