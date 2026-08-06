//test/modules/afp/agregarComisiones.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { AgregarComisionUseCase } from '@/modules/afp/use-cases/comision/agregarComision.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

//Mockear el generador de UUID para que siempre devuelva un valor predecible
jest.mock('@/common/utils/uuid.util', () => ({
    IdentityGenerator: {
        generateId: jest.fn(() => 'uuid-nueva-comision-123'),
    },
}));

/**
 * Pruebas unitarias para el caso de uso AgregarComisionUseCase.
 * Se utilizan mocks para PrismaService para simular la interacción con la base de datos.
 * Se verifican los diferentes escenarios, incluyendo la creación exitosa de una comisión,
 * la actualización de una comisión existente y el manejo de errores como AFP no encontrada o fallos en la base de datos.
 */
describe('AgregarComisionUseCase', () => {
    let useCase: AgregarComisionUseCase;
    let mockPrisma: any;

    //Configuracion inicial antes de cada prueba
    beforeEach(async () => {
        mockPrisma = {
            tipo_afp: { findUnique: jest.fn() },
            comisiones_afp: { update: jest.fn(), create: jest.fn() },
            //Simulador de la transacción que simplemente ejecuta y devuelve las promesas en orden
            $transaction: jest.fn(async (operaciones) => {
                const resultados = [];
                for (const op of operaciones) 
                    resultados.push(await op);
                
                return resultados;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AgregarComisionUseCase,
                { provide: PrismaService, useValue: mockPrisma }
            ]
        }).compile();

        useCase = module.get<AgregarComisionUseCase>(AgregarComisionUseCase);
    });

    afterEach(() => jest.clearAllMocks());

    it('Debería crear la comisión y CERRAR la anterior en una sola transacción (SCD Tipo 2)', async () => {
        //Arrange: Payload de prueba con una comisión anterior y una nueva comisión
        const payload = {
            tipo_afp_id: 'uuid-afp-integra',
            anterior_comision: { id: 'uuid-vieja', periodo_final: '2026-07-31' },
            nueva_comision: {
                periodo_inicio: '2026-08-01',
                aporte_obligatorio: 10,
                comision_sobre_ra: 1.55,
                prima_seguro: 1.84,
                comision_mixta: 0.78,
            },
        };

        //Validar que la AFP existe
        mockPrisma.tipo_afp.findUnique.mockResolvedValue({ id: 'uuid-afp-integra', nombre: 'AFP Integra' });
        
        //Generar resultados simulados para la actualización y creación de comisiones (Respuesta en cola)
        mockPrisma.comisiones_afp.update.mockResolvedValue({ id: 'uuid-vieja', periodo_final: new Date('2026-07-31') });
        mockPrisma.comisiones_afp.create.mockResolvedValue({ id: 'uuid-nueva-comision-123', ...payload.nueva_comision });

        //Act
        const result = await useCase.execute(payload as any);

        //Assert
        //Verificamos que se ejecutó la transacción
        expect(mockPrisma.$transaction).toHaveBeenCalled();
        
        //Verificar la cola de operaciones: Primero se cierra la comisión anterior, luego se crea la nueva
        expect(mockPrisma.comisiones_afp.update).toHaveBeenCalledWith({
            where: { id: 'uuid-vieja' },
            data: { periodo_final: expect.any(Date) },
        });
        expect(mockPrisma.comisiones_afp.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                afp_id: 'uuid-afp-integra',
                periodo_inicio: expect.any(Date),
                comision_sobre_ra: 1.55
            })
        });

        //Verificar que el resultado final sea la nueva comisión creada
        expect(result.id).toBe('uuid-nueva-comision-123');
    });

    it('Debería crear la comisión SIN intentar cerrar nada si es el primer registro de la AFP', async () => {
        //Arrange: Mismo payload pero sin 'anterior_comision'
        const payload = {
            tipo_afp_id: 'uuid-afp-integra',
            nueva_comision: {
                periodo_inicio: '2026-08-01',
                aporte_obligatorio: 10,
                comision_sobre_ra: 1.55,
                prima_seguro: 1.84,
                comision_mixta: 0.78,
            },
        };

        //Validar que la AFP existe
        mockPrisma.tipo_afp.findUnique.mockResolvedValue({ id: 'uuid-afp-integra' });
        mockPrisma.comisiones_afp.create.mockResolvedValue({ id: 'uuid-nueva-comision-123' });

        //Act
        await useCase.execute(payload as any);

        //Assert
        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(mockPrisma.comisiones_afp.update).not.toHaveBeenCalled(); // No cerró nada
        expect(mockPrisma.comisiones_afp.create).toHaveBeenCalled(); // Solo creó
    });

    it('Debería lanzar NotFoundException si la AFP enviada no existe en la BD', async () => {
        // Arrange
        const payload = { tipo_afp_id: 'uuid-afp-fantasma', nueva_comision: { /* ... */ } };
        mockPrisma.tipo_afp.findUnique.mockResolvedValue(null);

        //Act & Assert
        await expect(useCase.execute(payload as any)).rejects.toThrow(NotFoundException);
        await expect(useCase.execute(payload as any)).rejects.toMatchObject({
            response: expect.objectContaining({ title: 'AFP no encontrada' }),
        });
        
        //Verificamos que la base de datos no se haya tocado
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('Debería lanzar InternalServerErrorException si la transacción de BD falla (Rollback)', async () => {
        //Arrange
        const payload = { tipo_afp_id: 'uuid-afp-integra', nueva_comision: { /* ... */ } };
        mockPrisma.tipo_afp.findUnique.mockResolvedValue({ id: 'uuid-afp-integra' });
        
        //Simulamos que al intentar hacer el transaction, Prisma lanza un error (Ej. Base de datos caída)
        mockPrisma.$transaction.mockRejectedValue(new Error('Connection Lost'));

        //Act & Assert
        await expect(useCase.execute(payload as any)).rejects.toThrow(InternalServerErrorException);
        await expect(useCase.execute(payload as any)).rejects.toThrow('Ocurrió un error al intentar registrar la comisión');
    });
});