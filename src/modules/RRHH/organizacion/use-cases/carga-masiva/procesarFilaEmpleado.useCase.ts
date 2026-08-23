//src/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ReniecAdapter } from '../../services/reniec.adapter';
import { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';


/**
 * Caso de uso para procesar una fila individual de empleado durante la carga masiva.
 * Este caso de uso realiza un Upsert (Actualizar o Crear) de un empleado basado en el DNI.
 * La operación es atómica y está gobernada por la extensión de auditoría de Prisma.
 */
@Injectable()
export class ProcesarFilaEmpleadoUseCase {
  private readonly logger = new Logger(ProcesarFilaEmpleadoUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reniecAdapter: ReniecAdapter
  ) {}

  /**
   * Ejecuta el Upsert (Actualizar o Crear) de un empleado basado en el DNI.
   * Operación atómica gobernada por la extensión de auditoría de Prisma.
   */
  async execute(fila: CargaMasivaFilaDTO, jobId: string): Promise<void> {
    //Nro de documento y tipo de documento son obligatorios
    const nroDoc = ( fila.nro_documento || (fila as any).numero_documento || (fila as any).dni || (fila as any).nro_doc || (fila as any).documento || '' ).toString().trim();

    //Validar que el número de documento no esté vacío
    const tipoDocStr = (fila.tipo_documento || 'DNI').toString().trim();

    if (!nroDoc) throw new Error('El número de documento es obligatorio en la fila.');
    
    //Buscar el tipo de documento en la base de datos para validar su existencia
    const tipoDoc = await this.prisma.tipo_documento.findFirst({where: {tipo_documento: { equals: tipoDocStr, mode: 'insensitive' }}});

    if (!tipoDoc)throw new Error(`El tipo de documento '${fila.tipo_documento}' no existe en la base de datos.`);

    // 3. Resolución de Área (Búsqueda o Auto-Creación On-The-Fly)
    const areaNombre = (fila.area || (fila as any).departamento || 'General').toString().trim();

    let area = await this.prisma.area.findFirst({
      where: {
        nombre: { equals: areaNombre, mode: 'insensitive' },
        deleted_at: null,
      },
    });

    if (!area) {
      // Fallback tolerante a tildes (ej: 'Seguridad Fisica' vs 'Seguridad Física')
      const areasActivas = await this.prisma.area.findMany({
        where: { deleted_at: null },
      });
      const areaNormInput = normalizarTexto(areaNombre);
      area = areasActivas.find((a) => normalizarTexto(a.nombre) === areaNormInput) || null;
    }

    // AUTO-CREACIÓN DE ÁREA si no existe
    if (!area) {
      this.logger.log(`[CargaMasiva] Área '${areaNombre}' no encontrada. Creándola automáticamente...`);
      area = await this.prisma.area.create({
        data: {
          id: IdentityGenerator.generateId(),
          nombre: areaNombre,
          descripcion: 'Área creada automáticamente vía Carga Masiva CSV',
          activo: true,
        },
      });
    }

    // 4. Resolución de Cargo pertenecientes al Área (Búsqueda o Auto-Creación On-The-Fly)
    const cargoNombre = (fila.cargo || (fila as any).puesto || 'Operativo').toString().trim();

    let cargo = await this.prisma.cargo.findFirst({
      where: {
        nombre: { equals: cargoNombre, mode: 'insensitive' },
        id_area: area.id,
        deleted_at: null,
      },
    });

    if (!cargo) {
      const cargosArea = await this.prisma.cargo.findMany({
        where: { id_area: area.id, deleted_at: null },
      });
      const cargoNormInput = normalizarTexto(cargoNombre);
      cargo = cargosArea.find((c) => normalizarTexto(c.nombre) === cargoNormInput) || null;
    }

    // AUTO-CREACIÓN DE CARGO en el Área correspondiente si no existe
    if (!cargo) {
      this.logger.log(`[CargaMasiva] Cargo '${cargoNombre}' no encontrado en área '${area.nombre}'. Creándolo automáticamente...`);
      cargo = await this.prisma.cargo.create({
        data: {
          id: IdentityGenerator.generateId(),
          id_area: area.id,
          nombre: cargoNombre,
          descripcion: 'Cargo creado automáticamente vía Carga Masiva CSV',
          activo: true,
        },
      });
    }

    //Validar Jornada / Turno (Opcional)
    let jornadaId: string | null = null;
    if (fila.jornada) {
      const jornadaNombre = fila.jornada.toString().trim();
      const jornada = await this.prisma.jornada.findFirst({where: { nombre: { equals: jornadaNombre, mode: 'insensitive' }, deleted_at: null }});

      if (!jornada) throw new Error(`El turno/jornada '${jornadaNombre}' no existe.`);
      
      jornadaId = jornada.id;
    }

    //Obtener Estado de Empleado ACTIVO
    const estadoActivo = await this.prisma.estado_empleado.findFirst({where: { descripcion: 'ACTIVO' }});

    if (!estadoActivo) throw new Error('Catálogo de estado ACTIVO no configurado.');
    
    let nombre = fila.nombre || null;
    let apellido = fila.apellido || null;
    let estadoSincronizacion: 'COMPLETO' | 'BORRADOR' = 'COMPLETO';

    //Obtener el estado base de empleado (ACTIVO) para asignarlo al nuevo registro
    const estadoBase = await this.prisma.estado_empleado.findFirst({where: { descripcion: 'ACTIVO' }});

    if (!estadoBase) throw new Error('Catálogo de estado ACTIVO no configurado.');

    //Si el CSV no trae nombres, intentamos obtenerlos de RENIEC
    if ((!nombre || !apellido) && tipoDocStr.toUpperCase() === 'DNI') {
      try {
        this.logger.log(`Nombres no provistos en CSV para DNI ${nroDoc}. Consultando RENIEC...`);
        const ciudadano = await this.reniecAdapter.consultarDni(nroDoc);
        nombre = ciudadano.nombre;
        apellido = `${ciudadano.apellido_paterno} ${ciudadano.apellido_materno}`.trim();
      } catch (error: any) {
        this.logger.warn(`Degradando legajo DNI ${nroDoc} a BORRADOR. RENIEC inaccesible: ${error.message}`);
        nombre = nombre || 'NO_REGISTRADO';
        apellido = apellido || 'NO_REGISTRADO';
        estadoSincronizacion = 'BORRADOR';
      }
    }

    if (!nombre || !apellido) {
      nombre = nombre || 'NO_REGISTRADO';
      apellido = apellido || 'NO_REGISTRADO';
      estadoSincronizacion = 'BORRADOR';
    }

    //Inserción o Actualización (Upsert) del Empleado
    const fechaNac = fila.fecha_nacimiento ? new Date(fila.fecha_nacimiento) : null;

    //Persistencia Transaccional (Upsert para garantizar Idempotencia)
    await this.prisma.empleados.upsert({
      where: { nro_documento: nroDoc },
      update: {
        nombre,
        apellido,
        area_id: area.id,
        cargo_id: cargo.id,
        jornada_id: jornadaId,
        asig_familiar: Boolean(fila.asig_familiar),
        estado_sincronizacion: estadoSincronizacion,
        activo: true
      },
      create: {
        id: IdentityGenerator.generateId(),
        documento_id: tipoDoc.id,
        nro_documento: nroDoc,
        nombre,
        apellido,
        area_id: area.id,
        cargo_id: cargo.id,
        estado_empleado_id: estadoActivo.id,
        jornada_id: jornadaId,
        asig_familiar: Boolean(fila.asig_familiar),
        estado_sincronizacion: estadoSincronizacion,
        activo: true
      }
    });
  }
}

/**
 * Normaliza cadenas de texto removiendo tildes y diacríticos para búsquedas tolerantes.
 */
function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}