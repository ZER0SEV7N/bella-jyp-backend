//test/modules/RRHH/empleados/crearEmpleado.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CrearEmpleadoUseCase } from '@/modules/RRHH/use-cases/empleado/crearEmpleado.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ReniecAdapter } from '@/modules/RRHH/services/reniec.adapter';

//Mockear la generación de UUID para que siempre devuelva un valor predecible
jest.mock('@/common/utils/uuid.util', () => ({
  IdentityGenerator: { generateId: jest.fn(() => 'uuid-emp-123') },
}));

/**
 * Pruebas unitarias para el caso de uso CrearEmpleadoUseCase.
 * Se utilizan mocks para PrismaService y ReniecAdapter para simular la interacción con la base de datos y el servicio externo.
 * Se verifican los diferentes escenarios, incluyendo la creación exitosa de un empleado, la llamada a RENIEC cuando faltan datos,
 * y el manejo de errores como documentos duplicados o fallos en la verificación de identidad.
 */
describe('CrearEmpleadoUseCase', () => {
  let useCase: CrearEmpleadoUseCase;
  let mockPrisma: any;
  let mockReniec: any;

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    mockPrisma = { empleados: { findUnique: jest.fn(), create: jest.fn() } };
    mockReniec = { consultarDni: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrearEmpleadoUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ReniecAdapter, useValue: mockReniec },
      ],
    }).compile();

    useCase = module.get<CrearEmpleadoUseCase>(CrearEmpleadoUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  it('Debería crear un empleado con datos completos sin llamar a RENIEC', async () => {
    //Arrange: Simular que no existe un empleado con el mismo documento y que la creación es exitosa
    const payload = {
      nro_documento: '70112233',
      nombre: 'Juan',
      apellido: 'Perez',
      asig_familiar: false,
    };
    mockPrisma.empleados.findUnique.mockResolvedValue(null);
    mockPrisma.empleados.create.mockResolvedValue({
      id: 'uuid-emp-123',
      ...payload,
    });

    //Act: Ejecutar el caso de uso con los datos completos
    const result = await useCase.execute(payload as any);

    //Assert: Verificar que el empleado fue creado correctamente y que RENIEC no fue llamado
    expect(result).toEqual({ id: 'uuid-emp-123', ...payload });
    expect(result.nombre).toBe('Juan');
    expect(result.apellido).toBe('Perez');
    expect(mockReniec.consultarDni).not.toHaveBeenCalled();
    expect(mockPrisma.empleados.create).toHaveBeenCalled();
  });

  it('Debería llamar a RENIEC si faltan nombres y es un DNI (8 dígitos)', async () => {
    //Arrange: Simular que no existe un empleado con el mismo documento y que RENIEC devuelve datos válidos
    const payload = { nro_documento: '70112233' };
    mockPrisma.empleados.findUnique.mockResolvedValue(null);
    //Simular que RENIEC devuelve un ciudadano con nombre y apellidos
    mockReniec.consultarDni.mockResolvedValue({
      nombre: 'Carlos',
      apellido_paterno: 'Lopez',
      apellido_materno: 'Gomez',
    });
    mockPrisma.empleados.create.mockResolvedValue({});

    //Act: Ejecutar el caso de uso con un documento que requiere consulta a RENIEC
    await useCase.execute(payload as any);

    //Assert: Verificar que RENIEC fue llamado y que los datos fueron completados correctamente
    expect(mockReniec.consultarDni).toHaveBeenCalledWith('70112233');
    expect(mockPrisma.empleados.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nombre: 'Carlos',
          apellido: 'Lopez Gomez',
        }),
      }),
    );
  });

  it('Debería lanzar BadRequestException si RENIEC falla', async () => {
    //Arrange: Simular que no existe un empleado con el mismo documento y que RENIEC falla al consultar el DNI
    const payload = { nro_documento: '70112233' };
    mockPrisma.empleados.findUnique.mockResolvedValue(null);
    mockReniec.consultarDni.mockRejectedValue(new Error('RENIEC Timeout'));

    //Act & Assert: Ejecutar el caso de uso y verificar que se lance la excepción esperada
    await expect(useCase.execute(payload as any)).rejects.toMatchObject({
      response: expect.objectContaining({
        title: 'Fallo de Verificación de Identidad',
      }),
    });
    expect(mockReniec.consultarDni).toHaveBeenCalledWith('70112233');
    expect(mockPrisma.empleados.create).not.toHaveBeenCalled();
  });

  it('Debería lanzar BadRequestException si el documento ya está registrado', async () => {
    //Arrange: Simular que ya existe un empleado con el mismo documento
    const payload = { nro_documento: '70112233' };
    mockPrisma.empleados.findUnique.mockResolvedValue({ id: 'emp-existente' });

    //Act & Assert: Ejecutar el caso de uso y verificar que se lance la excepción esperada
    await expect(useCase.execute(payload as any)).rejects.toMatchObject({
      response: expect.objectContaining({ title: 'Documento Duplicado' }),
    });
  });
});
