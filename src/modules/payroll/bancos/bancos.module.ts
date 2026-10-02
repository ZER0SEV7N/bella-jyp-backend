//src/modules/payroll/bancos/bancos.module.ts
import { Module } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import { ListarBancosUseCase } from "./use-cases/listarBancos.useCase";
import { BancosController } from "./controller/bancos.controller";

@Module({
    imports: [],
    controllers: [BancosController],
    providers: [PrismaService, ListarBancosUseCase],
})
export class BancosModule {}