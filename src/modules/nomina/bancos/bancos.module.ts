//src/modules/nomina/bancos/bancos.module.ts
import { Module } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import { ListarBancosUseCase } from "./use-cases/listarBancos.useCase";
import { BancosController } from "./controller/bancos.controller";

/**
 * Módulo de Bancos.
 * Este módulo encapsula el controlador y los casos de uso relacionados con la gestión de bancos en el sistema de nómina.
 * Proporciona funcionalidades para listar bancos y obtener información detallada de un banco específico.
 * Este módulo es parte del sistema de nómina y está diseñado para ser utilizado por usuarios con roles específicos (ADMIN, CONTADOR, RRHH, ASISTENTE).
 */
@Module({
    imports: [],
    controllers: [BancosController],
    providers: [PrismaService, ListarBancosUseCase],
})
export class BancosModule {}