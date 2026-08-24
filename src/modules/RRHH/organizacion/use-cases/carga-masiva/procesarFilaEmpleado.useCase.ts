//src/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ReniecAdapter } from '../../services/reniec.adapter';
import { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { NormalizarTexto, NormalizarFechaNacimiento } from './helpers/cargaMasiva.helpers';

/**
 * Caso de uso para procesar la fila individual de un empleado en la carga masiva.
 * - Soporta asignación y guardado de `fecha_nacimiento`.
 * - Auto-crea el Área y el Cargo si no existen en la base de datos.
 * - Trata la Jornada/Turno de forma opcional (asigna null sin fallar si no existe).
 * - Omite la consulta a RENIEC si el CSV ya trae nombres y apellidos.
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
   * @param fila - DTO que representa la fila de empleado a procesar.
   * @param jobId - ID del job de carga masiva al que pertenece esta fila.
   * @returns Una promesa que se resuelve cuando se completa el procesamiento de la fila.
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
        deleted_at: null
      }
    });

    if (!area) {
      //Fallback tolerante a tildes (ej: 'Seguridad Fisica' vs 'Seguridad Física')
      const areasActivas = await this.prisma.area.findMany({where: { deleted_at: null }});
      const areaNormInput = NormalizarTexto(areaNombre);
      area = areasActivas.find((a) => NormalizarTexto(a.nombre) === areaNormInput) || null;
    }

    //AUTO-CREACIÓN DE ÁREA si no existe
    if (!area) {
      this.logger.log(`[CargaMasiva] Área '${areaNombre}' no encontrada. Creándola automáticamente...`);
      area = await this.prisma.area.create({
        data: {
          id: IdentityGenerator.generateId(),
          nombre: areaNombre,
          descripcion: 'Área creada automáticamente vía Carga Masiva CSV',
          activo: true
        }
      });
    }

    //Resolución de Cargo pertenecientes al Área (Búsqueda o Auto-Creación On-The-Fly)
    const cargoNombre = (fila.cargo || (fila as any).puesto || 'Operativo').toString().trim();

    let cargo = await this.prisma.cargo.findFirst({
      where: {
        nombre: { equals: cargoNombre, mode: 'insensitive' },
        id_area: area.id,
        deleted_at: null
      }
    });

    if (!cargo) {
      //Fallback tolerante a tildes (ej: 'Analista de RRHH' vs 'Analista de RR.HH.')
      const cargosArea = await this.prisma.cargo.findMany({where: { id_area: area.id, deleted_at: null }});
      const cargoNormInput = NormalizarTexto(cargoNombre);
      cargo = cargosArea.find((c) => NormalizarTexto(c.nombre) === cargoNormInput) || null;
    }

    //Auto-Creación de Cargo si no existe
    if (!cargo) {
      this.logger.log(`[CargaMasiva] Cargo '${cargoNombre}' no encontrado en área '${area.nombre}'. Creándolo automáticamente...`);
      cargo = await this.prisma.cargo.create({
        data: {
          id: IdentityGenerator.generateId(),
          id_area: area.id,
          nombre: cargoNombre,
          descripcion: 'Cargo creado automáticamente vía Carga Masiva CSV',
          activo: true
        }
      });
    }

    //Validar Jornada / Turno (Opcional)
    let jornadaId: string | null = null;
    const jornadaNombre = (fila.jornada || (fila as any).turno || (fila as any).horario || '').toString().trim();

    //Si se proporciona un nombre de jornada, intentar resolverlo en la base de datos
    if (jornadaNombre) {
      let jornada = await this.prisma.jornada.findFirst({
        where: { nombre: { equals: jornadaNombre, mode: 'insensitive' }, deleted_at: null}
      });

      //Fallback tolerante a tildes para jornadas (ej: 'Turno Mañana' vs 'Turno Mañána')
      if (!jornada) {
        const jornadasActivas = await this.prisma.jornada.findMany({where: { deleted_at: null }});
        const jornadaNormInput = NormalizarTexto(jornadaNombre);
        jornada = jornadasActivas.find((j) => NormalizarTexto(j.nombre) === jornadaNormInput) || null;
      }

      //Si la jornada existe, asignar su ID; si no, registrar una advertencia y dejar jornadaId como null
      if (jornada) jornadaId = jornada.id;
      else  this.logger.warn(`[CargaMasiva] El turno '${jornadaNombre}' no existe en BD. Se registrará al empleado sin jornada asignada.`);
    }

    //Obtener Estado de Empleado ACTIVO
    const estadoActivo = await this.prisma.estado_empleado.findFirst({where: { descripcion: 'ACTIVO' }});

    if (!estadoActivo) throw new Error('Catálogo de estado ACTIVO no configurado.');

    //Parsear la fecha de nacimiento usando el helper NormalizarFechaNacimiento
    const fechaNacimiento = NormalizarFechaNacimiento(fila.fecha_nacimiento || (fila as any).fec_nac || (fila as any).cumpleaños || (fila as any).cumpleanios);
    
    //Determinar nombres y apellidos, consultando RENIEC si es necesario
    let nombre = fila.nombre || null;
    let apellido = fila.apellido || null;
    let estadoSincronizacion: 'COMPLETO' | 'BORRADOR' = 'COMPLETO';

    //Si el CSV no trae nombres y apellidos, intentamos obtenerlos de RENIEC
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

    //Persistencia Transaccional (Upsert para garantizar Idempotencia)
    await this.prisma.empleados.upsert({
      where: { nro_documento: nroDoc },
      update: {
        nombre,
        apellido,
        area_id: area.id,
        cargo_id: cargo.id,
        jornada_id: jornadaId,
        fecha_nacimiento: fechaNacimiento,
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
        fecha_nacimiento: fechaNacimiento,
        asig_familiar: Boolean(fila.asig_familiar),
        estado_sincronizacion: estadoSincronizacion,
        activo: true
      }
    });
  }
}

