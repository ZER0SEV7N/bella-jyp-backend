import { Injectable } from '@nestjs/common';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AportacionesDto } from '@jyp/shared-contracts';
@Injectable()
export class agregarAportacionAfpUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(dto: AportacionesDto) {
    //validar si el afp exite
    
  }
}
