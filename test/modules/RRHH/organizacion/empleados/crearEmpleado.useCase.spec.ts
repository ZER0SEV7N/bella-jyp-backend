//test/modules/RRHH/organizacion/empleados/crearEmpleado.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CrearEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/empleado/crearEmpleado.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ReniecAdapter } from '@/modules/RRHH/organizacion/services/reniec.adapter';
import { CrearEmpleadoDto } from '@jyp/shared-contracts';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';

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
describe('CrearEmpleadoUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: CrearEmpleadoUseCase;
  let prisma: PrismaService;
  let reniec: ReniecAdapter;

  const mockPrisma = {
    empleados: { findFirst: jest.fn(), create: jest.fn() },
    area: { findUnique: jest.fn() },
    cargo: { findUnique: jest.fn() },
    tipo_documento: { findUnique: jest.fn() },
    estado_empleado: { findUnique: jest.fn() },
    jornada: { findUnique: jest.fn() },
  };

  const mockReniec = {
    consultarDni: jest.fn(),
  };

  const payloadValido: CrearEmpleadoDto = {
    cargo_id: '018f4a7c-cargo-0000-0000-000000000001',
    area_id: '018f4a7c-area-0000-0000-000000000001',
    documento_id: '018f4a7c-tdoc-0000-0000-000000000001',
    estado_empleado_id: '018f4a7c-est-0000-0000-000000000001',
    nro_documento: '70112233',
    nombre: 'Juan',
    apellido: 'Perez',
    asig_familiar: false,
    fecha_nacimiento: '1995-05-15T00:00:00.000Z',
    fecha_inicio: '2026-09-01T00:00:00.000Z',
  };

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrearEmpleadoUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ReniecAdapter, useValue: mockReniec },
      ],
    }).compile();

    useCase = module.get<CrearEmpleadoUseCase>(CrearEmpleadoUseCase);
    prisma = module.get<PrismaService>(PrismaService);
    reniec = module.get<ReniecAdapter>(ReniecAdapter);

    // Configurar entidades foráneas activas por defecto
    mockPrisma.area.findUnique.mockResolvedValue({ id: payloadValido.area_id, activo: true });
    mockPrisma.cargo.findUnique.mockResolvedValue({ id: payloadValido.cargo_id, activo: true });
    mockPrisma.tipo_documento.findUnique.mockResolvedValue({ id: payloadValido.documento_id });
    mockPrisma.estado_empleado.findUnique.mockResolvedValue({ id: payloadValido.estado_empleado_id });
  });

  afterEach(() => jest.clearAllMocks());

  describe('Casos de Éxito (Happy Path)', () => {
    it('Debe crear un empleado con datos completos sin llamar a RENIEC', async () => {
      //Arrange: Simular que no existe un empleado con el mismo documento y que la creación es exitosa
      mockPrisma.empleados.findFirst.mockResolvedValue(null);
      mockPrisma.empleados.create.mockResolvedValue({ id: 'uuid-emp-123', ...payloadValido });

      //Act: Ejecutar el caso de uso con los datos completos
      const result = await useCase.execute(payloadValido);

      //Assert: Verificar que el empleado fue creado correctamente y que RENIEC no fue llamado
      expect(result).toEqual(expect.objectContaining({ id: 'uuid-emp-123', nombre: 'Juan', apellido: 'Perez' }));
      expect(mockReniec.consultarDni).not.toHaveBeenCalled();
      expect(mockPrisma.empleados.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          id: 'uuid-emp-123',
          nro_documento: '70112233',
          nombre: 'Juan',
          apellido: 'Perez',
          activo: true
        })
      }));
    });

    it('Debe llamar a RENIEC si faltan nombres y es un DNI (8 dígitos)', async () => {
      //Arrange: Simular que no existe un empleado con el mismo documento y que RENIEC devuelve datos válidos
      const payloadSinNombre: CrearEmpleadoDto = {
        ...payloadValido,
        nombre: null,
        apellido: null
      };

      mockPrisma.empleados.findFirst.mockResolvedValue(null);
      mockReniec.consultarDni.mockResolvedValue({
        nombre: 'Carlos',
        apellido_paterno: 'Lopez',
        apellido_materno: 'Gomez',
      });
      mockPrisma.empleados.create.mockResolvedValue({
        id: 'uuid-emp-123',
        ...payloadSinNombre,
        nombre: 'Carlos',
        apellido: 'Lopez Gomez',
      });

      //Act: Ejecutar el caso de uso con un documento que requiere consulta a RENIEC
      const result = await useCase.execute(payloadSinNombre);

      //Assert: Verificar que RENIEC fue llamado y que los datos fueron completados correctamente
      expect(mockReniec.consultarDni).toHaveBeenCalledWith('70112233');
      expect(result.nombre).toBe('Carlos');
      expect(result.apellido).toBe('Lopez Gomez');
      expect(mockPrisma.empleados.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          nombre: 'Carlos',
          apellido: 'Lopez Gomez'
        })
      }));
    });
  });

  describe('Validaciones de Negocio y Excepciones', () => {
    it('Debe lanzar BadRequestException si el documento ya está registrado', async () => {
      //Arrange: Simular que ya existe un empleado con el mismo documento
      mockPrisma.empleados.findFirst.mockResolvedValue({ id: 'emp-existente' });

      //Act & Assert: Ejecutar el caso de uso y verificar que se lance la excepción esperada
      await expect(useCase.execute(payloadValido)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.empleados.create).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si alguna entidad foránea no existe o está inactiva', async () => {
      //Arrange: Simular que el área asignada se encuentra inactiva
      mockPrisma.empleados.findFirst.mockResolvedValue(null);
      mockPrisma.area.findUnique.mockResolvedValue({ id: payloadValido.area_id, activo: false });

      //Act & Assert: Ejecutar el caso de uso y verificar que se rechace la creación
      await expect(useCase.execute(payloadValido)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.empleados.create).not.toHaveBeenCalled();
    });

    it('Debe lanzar BadRequestException si RENIEC falla', async () => {
      //Arrange: Simular que no existe el documento pero RENIEC falla al consultar el DNI
      const payloadSinNombre: CrearEmpleadoDto = { ...payloadValido, nombre: null, apellido: null };
      mockPrisma.empleados.findFirst.mockResolvedValue(null);
      mockReniec.consultarDni.mockRejectedValue(new Error('RENIEC Gateway Timeout'));

      //Act & Assert: Ejecutar el caso de uso y verificar que se capture el fallo de identidad
      await expect(useCase.execute(payloadSinNombre)).rejects.toThrow(BadRequestException);
      expect(mockReniec.consultarDni).toHaveBeenCalledWith('70112233');
      expect(mockPrisma.empleados.create).not.toHaveBeenCalled();
    });

    it('Debe capturar errores de base de datos y lanzar InternalServerErrorException', async () => {
      //Arrange: Simular error inesperado durante la persistencia en base de datos
      mockPrisma.empleados.findFirst.mockResolvedValue(null);
      mockPrisma.empleados.create.mockRejectedValue(new Error('Conexión PostgreSQL cerrada'));

      //Act & Assert: Ejecutar el caso de uso y verificar que se envuelva en InternalServerErrorException
      await expect(useCase.execute(payloadValido)).rejects.toThrow(InternalServerErrorException);
    });
  });
});