import { PrismaService } from '@/common/prisma/prisma.service';
import { ActualizarCargoUseCase } from '@/modules/RRHH/use-cases/cargos/actualizarCargo.UseCase';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

describe('ActulizarCargoUseCase', async () => {
 let useCase: ActualizarCargoUseCase;
 let mockPrisma = {
    cargo: { findUnique: jest.fn(), update: jest.fn() },
    area: { findUnique: jest.fn() },
 }
});