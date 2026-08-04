//test/modules/auth/provisionarUsuario.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ProvisionarUsuarioUseCase } from '@/modules/auth/use-cases/provisionarUsuario.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

//Mock de Argon2 para simular el hash de contraseñas
jest.mock('argon2', () => ({
    hash: jest.fn(async () => 'hashed_password_mock'),
    argon2id: 2, //Constante requerida por tu código real
}))

//Mock de Crypto para simular la generación de UUID
jest.mock('crypto', () => ({
    randomUUID: jest.fn(() => 'uuid-1234-5678'),
}));

