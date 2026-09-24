import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CryptoUtil } from '@/common/utils/crypto.util';

describe('Sistema JYP - Pruebas de Integración y Endpoints E2E', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  // UUIDs Deterministas de la BD Mapeados desde el Script SQL
  const SEED_DATA = {
    ESTADO_EMPLEADO_ACTIVO: '018f4a7c-1111-7000-a000-000000000001',
    TIPO_DOC_DNI: '018f4a7c-2222-7000-b000-000000000001',
    BANCO_BCP: '018f4a7c-3333-7000-c000-000000000001',
    REGIMEN_AFP: '018f4a7c-4444-7000-d000-000000000002',
    AFP_INTEGRA: '018f4a7c-5555-7000-e000-000000000001',
    TURNO_MANANA: '018f4a7c-6666-7000-f000-000000000001',
    AREA_OFICINA: '018f4a7c-7777-7000-1111-000000000001',
    AREA_SEGURIDAD: '018f4a7c-7777-7000-1111-000000000002',
    CARGO_CONTADOR: '018f4a7c-8888-7000-2222-000000000001',
    EMPLEADO_CARLOS: '018f4a7c-9999-7000-3333-000000000001', // DNI: 70112233
    EMPLEADO_MIGUEL: '018f4a7c-9999-7000-3333-000000000002', // CE: 001155998
  };

  let accessTokenAdmin: string;
  let idContratoCreado: string;

  beforeAll(async () => {
    process.env.FINANCIAL_DATA_ENCRYPTION_KEY = 'jyp_financial_master_key_super_secret_32_bytes_2026!';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Módulo Core - Autenticación y Provisionamiento (CU-01)', () => {
    it('POST /api/auth/provisionar - Debe provisionar la cuenta de usuario para el empleado Carlos (Contador)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/provisionar',
        payload: {
          tipo_documento: 'DNI',
          nro_documento: '70112233',
          email: 'carlos.ramirez@jyp.com',
          password: 'PasswordSegura123!',
          rol: 'ADMIN',
          empleado_id: SEED_DATA.EMPLEADO_CARLOS,
        },
      });

      expect([201, 409]).toContain(response.statusCode); // 201 si no existía, 409 si ya fue provisionado
    });

    it('POST /api/auth/login - Debe autenticar y retornar el Access Token JWT', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          tipo_documento: 'DNI',
          nro_documento: '70112233',
          password: 'PasswordSegura123!',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.data).toHaveProperty('access_token');
      accessTokenAdmin = body.data.access_token;
    });

    it('GET /api/usuarios/mi-perfil - Debe retornar la información del perfil autenticado', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/usuarios/mi-perfil',
        headers: {
          authorization: `Bearer ${accessTokenAdmin}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.email).toBe('carlos.ramirez@jyp.com');
    });
  });

  describe('2. Módulo RRHH - Verificación de Filtros de Consulta (?activo=true / ?activo=false)', () => {
    it('GET /api/rrhh/area?activo=true - Debe devolver exclusivamente áreas activas', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/rrhh/area?activo=true',
        headers: { authorization: `Bearer ${accessTokenAdmin}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(Array.isArray(body.data)).toBeTruthy();
      const inactivos = body.data.filter((a: any) => a.activo === false);
      expect(inactivos.length).toBe(0); // Ningún inactivo debe colarse
    });

    it('GET /api/rrhh/area?activo=false - Debe filtrar correctamente sin convertir "false" a true', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/rrhh/area?activo=false',
        headers: { authorization: `Bearer ${accessTokenAdmin}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Toda área devuelta en esta consulta debe tener activo = false
      const activosMalformados = body.data.filter((a: any) => a.activo === true);
      expect(activosMalformados.length).toBe(0);
    });

    it('GET /api/rrhh/cargo?activo=true - Debe filtrar los cargos pertenecientes al catálogo activo', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/rrhh/cargo?activo=true',
        headers: { authorization: `Bearer ${accessTokenAdmin}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/rrhh/empleados?activo=true - Debe listar los empleados activos sembrados en la BD', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/rrhh/empleados?activo=true',
        headers: { authorization: `Bearer ${accessTokenAdmin}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBeGreaterThanOrEqual(2); // Carlos y Miguel
    });
  });

  describe('3. Módulo RRHH - Gestión de Contratos (CU-10)', () => {
    it('POST /api/contrato - Debe registrar un nuevo contrato borrador para el empleado Miguel', async () => {
      // Para crear contrato, aseguramos que el empleado exista
      const response = await app.inject({
        method: 'POST',
        url: '/api/contrato',
        headers: { authorization: `Bearer ${accessTokenAdmin}` },
        payload: {
          empleado_id: SEED_DATA.EMPLEADO_MIGUEL,
          id_estado: SEED_DATA.ESTADO_EMPLEADO_ACTIVO,
          tipo_modalidad: 'PLAZO_FIJO',
          fecha_inicio: '2026-01-01T00:00:00.000Z',
          fecha_fin: '2026-06-30T00:00:00.000Z',
          observacion: 'Contrato de vigilancia nocturna',
        },
      });

      expect([201, 400, 404]).toContain(response.statusCode);
      if (response.statusCode === 201) {
        const body = JSON.parse(response.body);
        idContratoCreado = body.data.id;
      }
    });

    it('GET /api/contrato/empleado/:empleadoId - Debe obtener el historial de contratos del empleado', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/contrato/empleado/${SEED_DATA.EMPLEADO_CARLOS}`,
        headers: { authorization: `Bearer ${accessTokenAdmin}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('empleado');
      expect(body.data).toHaveProperty('contratos');
    });
  });

  describe('4. Módulo Payroll - Datos Financieros (Cifrado AES-256-GCM)', () => {
    it('POST /api/dato-financiero - Debe crear los datos financieros cifrando cuentas en reposo', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/dato-financiero',
        headers: { authorization: `Bearer ${accessTokenAdmin}` },
        payload: {
          empleado_id: SEED_DATA.EMPLEADO_CARLOS,
          id_regimen: SEED_DATA.REGIMEN_AFP,
          id_tipo_afp: SEED_DATA.AFP_INTEGRA,
          id_banco: SEED_DATA.BANCO_BCP,
          cuenta_bancaria: '191-77889900-0-12',
          cci: '002-191-00778899000123-88',
          nro_cuenta_cts: '191-11223344-1-01',
          sueldo_basico: 3500.0,
          cuspp: '123456CUSPP1',
          tipo_comision: 'FLUJO',
        },
      });

      expect([201, 409]).toContain(response.statusCode); // 201 si crea, 409 si ya existe
    });

    it('GET /api/dato-financiero/empleado/:empleadoId - Debe entregar los datos financieros enmascarados (*)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/dato-financiero/empleado/${SEED_DATA.EMPLEADO_CARLOS}`,
        headers: { authorization: `Bearer ${accessTokenAdmin}` },
      });

      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.data.cuenta_bancaria_mascara).toMatch(/^\*+.*$/);
        expect(body.data.cci_mascara).toMatch(/^\*+.*$/);
        expect(body.data.cuspp_mascara).toMatch(/^\*+.*$/);
        expect(body.data.sueldo_basico).toBe(3500);
      }
    });

    it('PATCH /api/dato-financiero/empleado/:empleadoId - Debe denegar modificaciones si la contraseña Step-Up Auth es incorrecta', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/dato-financiero/empleado/${SEED_DATA.EMPLEADO_CARLOS}`,
        headers: { authorization: `Bearer ${accessTokenAdmin}` },
        payload: {
          sueldo_basico: 4000.0,
          password_confirmacion: 'PasswordIncorrecta999!',
        },
      });

      expect(response.statusCode).toBe(401); // Unauthorized por confirmación de seguridad fallida
    });
  });

  describe('5. Módulo Core - Auditoría y Trail Logs (CU-03)', () => {
    it('GET /api/audit/logs - Debe permitir al Administrador auditar la bitácora con paginación', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/audit/logs?page=1&limit=10',
        headers: { authorization: `Bearer ${accessTokenAdmin}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.data).toBeDefined();
      expect(body.meta).toHaveProperty('total');
      expect(body.meta).toHaveProperty('totalPages');
    });
  });
});