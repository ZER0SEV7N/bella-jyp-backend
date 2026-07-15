import { Test, TestingModule } from '@nestjs/testing';
import { EliminarAreaUseCase } from '@/modules/RRHH/use-cases/area';
import { PrismaService } from '@/common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
