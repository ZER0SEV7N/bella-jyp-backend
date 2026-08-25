//src/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ReniecAdapter } from '../../services/reniec.adapter';
import { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { NormalizarTexto, NormalizarFecha } from './helpers/cargaMasiva.helpers';

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
    const nroDoc = (fila.nro_documento || (fila as any).numero_documento || (fila as any).dni || (fila as any).nro_doc || (fila as any).documento || '').toString().trim();
    const tipoDocStr = (fila.tipo_documento || 'DNI').toString().trim();

    if (!nroDoc) 
      throw new Error('El número de documento es obligatorio en la fila.');
    

    const tipoDoc = await this.buscarTipoDocumento(tipoDocStr, fila.tipo_documento);
    const area = await this.resolverArea((fila.area || (fila as any).departamento || 'General').toString().trim());
    const cargo = await this.resolverCargo(area.id, (fila.cargo || (fila as any).puesto || 'Operativo').toString().trim());
    const jornadaId = await this.resolverJornadaId((fila.jornada || (fila as any).turno || (fila as any).horario || '').toString().trim());

    const estadoActivo = await this.prisma.estado_empleado.findFirst({ where: { descripcion: 'ACTIVO' } });
    if (!estadoActivo) throw new Error('Catálogo de estado ACTIVO no configurado.');

    const fechaNacimiento = NormalizarFecha(fila.fecha_nacimiento || (fila as any).fec_nac || (fila as any).cumpleaños || (fila as any).cumpleanios);
    const fechaInicio = NormalizarFecha((fila as any).fecha_inicio || (fila as any).fec_inicio || (fila as any).fecha_ingreso || (fila as any).fec_ingreso);
    const { nombre, apellido, estadoSincronizacion } = await this.resolverDatosEmpleado(fila, nroDoc, tipoDocStr);

    await this.prisma.empleados.upsert({
      where: { nro_documento: nroDoc },
      update: {
        nombre,
        apellido,
        area_id: area.id,
        cargo_id: cargo.id,
        jornada_id: jornadaId,
        fecha_nacimiento: fechaNacimiento,
        fecha_inicio: fechaInicio,
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
        fecha_inicio: fechaInicio,
        asig_familiar: Boolean(fila.asig_familiar),
        estado_sincronizacion: estadoSincronizacion,
        activo: true
      }
    });
  }

  private async buscarTipoDocumento(tipoDocStr: string, tipoDocOriginal?: string) {
    const tipoDoc = await this.prisma.tipo_documento.findFirst({
      where: { tipo_documento: { equals: tipoDocStr, mode: 'insensitive' } }
    });

    if (!tipoDoc) 
      throw new Error(`El tipo de documento '${tipoDocOriginal ?? tipoDocStr}' no existe en la base de datos.`);

    return tipoDoc;
  }

  private async resolverArea(areaNombre: string) {
    let area = await this.prisma.area.findFirst({
      where: {
        nombre: { equals: areaNombre, mode: 'insensitive' },
        deleted_at: null
      }
    });

    if (!area) {
      const areasActivas = await this.prisma.area.findMany({ where: { deleted_at: null } });
      const areaNormInput = NormalizarTexto(areaNombre);
      area = areasActivas.find((a) => NormalizarTexto(a.nombre) === areaNormInput) || null;
    }

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

    return area;
  }

  private async resolverCargo(areaId: string, cargoNombre: string) {
    let cargo = await this.prisma.cargo.findFirst({
      where: {
        nombre: { equals: cargoNombre, mode: 'insensitive' },
        id_area: areaId,
        deleted_at: null
      }
    });

    if (!cargo) {
      const cargosArea = await this.prisma.cargo.findMany({ where: { id_area: areaId, deleted_at: null } });
      const cargoNormInput = NormalizarTexto(cargoNombre);
      cargo = cargosArea.find((c) => NormalizarTexto(c.nombre) === cargoNormInput) || null;
    }

    if (!cargo) {
      this.logger.log(`[CargaMasiva] Cargo '${cargoNombre}' no encontrado en área '${cargoNombre}'. Creándolo automáticamente...`);
      cargo = await this.prisma.cargo.create({
        data: {
          id: IdentityGenerator.generateId(),
          id_area: areaId,
          nombre: cargoNombre,
          descripcion: 'Cargo creado automáticamente vía Carga Masiva CSV',
          activo: true
        }
      });
    }

    return cargo;
  }

  private async resolverJornadaId(jornadaNombre: string): Promise<string | null> {
    if (!jornadaNombre) return null;

    let jornada = await this.prisma.jornada.findFirst({where: { nombre: { equals: jornadaNombre, mode: 'insensitive' }, deleted_at: null }});

    if (!jornada) {
      const jornadasActivas = await this.prisma.jornada.findMany({ where: { deleted_at: null } });
      const jornadaNormInput = NormalizarTexto(jornadaNombre);
      jornada = jornadasActivas.find((j) => NormalizarTexto(j.nombre) === jornadaNormInput) || null;
    }

    if (!jornada) {
      this.logger.warn(`[CargaMasiva] El turno '${jornadaNombre}' no existe en BD. Se registrará al empleado sin jornada asignada.`);
      return null;
    }

    return jornada.id;
  }

  private async resolverDatosEmpleado(fila: any, nroDoc: string, tipoDocStr: string) {
    let nombre = fila.nombre || null;
    let apellido = fila.apellido || null;
    let estadoSincronizacion: 'COMPLETO' | 'BORRADOR' = 'COMPLETO';

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

    return { nombre, apellido, estadoSincronizacion };
  }
}