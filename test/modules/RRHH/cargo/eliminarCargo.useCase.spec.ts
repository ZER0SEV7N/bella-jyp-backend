import { PrismaService } from "@/common/prisma/prisma.service";
import { EliminarAreaUseCase } from "@/modules/RRHH/use-cases/area/eliminarArea.useCase";
import { EliminarCargoUseCase } from "@/modules/RRHH/use-cases/cargos/eliminarCargo.UseCase";

describe('EliminarCargoUseCase', () => {
    let useCase: EliminarAreaUseCase;
    let prisma: PrismaService;
    //mock del prisma
    const mockPrismaService = {
        cargo: {
         findUnique: jest.fn(),
        },
        empleado: {
            
        }
    }
});