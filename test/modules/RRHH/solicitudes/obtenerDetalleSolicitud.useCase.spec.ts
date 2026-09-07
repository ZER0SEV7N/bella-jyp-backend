//test/modules/RRHH/solicitudes/obtenerDetalleSolicitud.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ObtenerDetalleSolicitudUseCase } from '@/modules/RRHH/solicitudes/use-cases/obtenerDetalleSolicitud.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Pruebas unitarias para el caso de uso ObtenerDetalleSolicitudUseCase.
 * Estas pruebas verifican la correcta obtención del detalle de una solicitud,
 * incluyendo la validación de existencia, el cálculo de antigüedad del colaborador
 * y la generación de alertas de urgencia según el estado y la fecha de inicio.
 * Se utilizan mocks para simular la interacción con la base de datos a través de PrismaService.
 */
describe('ObtenerDetalleSolicitudUseCase - Pruebas Unitarias', () => {
    let useCase: ObtenerDetalleSolicitudUseCase;
    let prisma: PrismaService;

    //Mocks de PrismaService para simular la base de datos
    const mockPrisma = { solicitud: { findFirst: jest.fn() } };

    //Datos de prueba para una solicitud ficticia
    const solicitudBaseMock = {
        id: 'sol-uuid-1',
        codigo: 'SOL-2026-001',
        estado: 'PENDIENTE',
        fecha_inicio: new Date('2026-12-01'),
        empleados: {
            id: 'emp-1',
            nombre: 'Lucía',
            apellido: 'Vargas',
            nro_documento: '71223344',
            fecha_inicio: new Date('2024-01-15'),
            area: { id: 'area-1', nombre: 'Contabilidad' },
            cargo: { id: 'cargo-1', nombre: 'Asistente' }
        },
        responsable: null
    };

    //Configuración inicial de las pruebas, creando un módulo de prueba y obteniendo instancias de los casos de uso y servicios
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ObtenerDetalleSolicitudUseCase,
                { provide: PrismaService, useValue: mockPrisma }
            ]
        }).compile();

        useCase = module.get<ObtenerDetalleSolicitudUseCase>(ObtenerDetalleSolicitudUseCase);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => jest.clearAllMocks());

    it('Happy Path: Debe obtener el detalle calculando antigüedad y sin alerta si el periodo es futuro', async () => {
        //Arrange: Se simula que la solicitud existe y se espera que se devuelva correctamente con los detalles del colaborador y sin alerta de urgencia.
        mockPrisma.solicitud.findFirst.mockResolvedValue(solicitudBaseMock);

        //Act: Se ejecuta el caso de uso con el código correlativo de la solicitud
        const resultado = await useCase.execute('SOL-2026-001');

        //Assert: Se verifica que el resultado tenga los datos correctos, incluyendo el código, nombre completo del colaborador, antigüedad calculada y sin alerta de urgencia
        expect(resultado.codigo).toBe('SOL-2026-001');
        expect(resultado.colaborador_resumen.nombre_completo).toBe('Lucía Vargas');
        expect(resultado.colaborador_resumen.antiguedad).toBeDefined();
        expect(resultado.alerta_urgencia).toBeNull();
    });

    it('Debe generar alerta_urgencia si el estado es PENDIENTE y la fecha de inicio es hoy o ya pasó', async () => {
        //Arrange: Se simula que la solicitud existe, está en estado PENDIENTE y la fecha de inicio es ayer, lo que debería generar una alerta de urgencia.
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);

        //Se simula que la solicitud existe y está en estado PENDIENTE con fecha de inicio en el pasado
        mockPrisma.solicitud.findFirst.mockResolvedValue({
            ...solicitudBaseMock,
            estado: 'PENDIENTE',
            fecha_inicio: ayer
        });

        //Act: Se ejecuta el caso de uso con el ID de la solicitud
        const resultado = await useCase.execute('sol-uuid-1');

        //Assert: Se verifica que el resultado tenga la alerta de urgencia generada correctamente
        expect(resultado.alerta_urgencia).not.toBeNull();
        expect(resultado.alerta_urgencia?.mensaje).toContain('Atención inmediata');
    });

    it('Debe lanzar NotFoundException si no coincide ni por UUID ni por código correlativo', async () => {
        //Arrange: Se simula que no existe ninguna solicitud con el ID o código proporcionado, lo que debería generar una NotFoundException.
        mockPrisma.solicitud.findFirst.mockResolvedValue(null);

        //Act & Assert: Se espera que se lance una NotFoundException al intentar obtener el detalle de una solicitud inexistente
        await expect(useCase.execute('SOL-9999-999')).rejects.toThrow(NotFoundException);
    });
});