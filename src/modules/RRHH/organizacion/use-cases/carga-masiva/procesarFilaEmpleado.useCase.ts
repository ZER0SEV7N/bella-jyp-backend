//src/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ReniecAdapter } from '../../services/reniec.adapter';
import type { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { sanitizarTexto } from '@/common/utils/transformacion.util';
import { normalizarFecha } from './helpers/normalizaciones.helper';

/**
 * Caso de uso para procesar una fila de datos de empleado en la carga masiva.
 * Este caso de uso se encarga de validar, transformar y persistir los datos de un empleado
 * en la base de datos, asegurando la integridad y consistencia de la información.
 */
@Injectable()
export class ProcesarFilaEmpleadoUseCase {
  private readonly logger = new Logger(ProcesarFilaEmpleadoUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reniecAdapter: ReniecAdapter,
  ) {}

  /**
   * Método principal para ejecutar el procesamiento de una fila de empleado.
   * Este método realiza las siguientes acciones:
   * 1. Normaliza y valida los datos de la fila.
   * 2. Resuelve los catálogos organizacionales (tipo de documento, área, cargo, jornada).
   * 3. Persiste de manera atómica los datos del empleado y su información financiera asociada.
   * 4. Maneja errores y excepciones, registrando los fallos en el log y actualizando el estado del job.
   * @param fila - Objeto que contiene los datos de la fila de empleado a procesar.
   * @param jobId - ID del job de carga masiva.
   * @throws - Lanza errores si ocurre algún fallo durante el procesamiento, los cuales son manejados por el worker.
   */
  async execute(fila: CargaMasivaFilaDTO, jobId: string): Promise<void> {
    const nroDoc = fila.nro_documento.trim();

    //Transformar y normalizar los datos de la fila antes de persistirlos
    const tipoDoc = await this.buscarTipoDocumento(fila.tipo_documento);
    const area = await this.resolverArea(fila.area);
    const cargo = await this.resolverCargo(area.id, fila.cargo);
    const jornadaId = await this.resolverJornadaId(fila.jornada);

    //Validar que el estado "ACTIVO" esté presente en la base de datos antes de asignarlo al empleado
    const estadoActivo = await this.prisma.estado_empleado.findFirst({where: { descripcion: 'ACTIVO' }});
    if (!estadoActivo) throw new Error('Catálogo de estado ACTIVO no configurado en BD.');

    //Normalizar fechas y resolver nombres completos del empleado, así como su estado de sincronización
    const fechaNacimiento = normalizarFecha(fila.fecha_nacimiento);
    const fechaInicio = normalizarFecha(fila.fecha_inicio) ?? new Date();
    const { nombre, apellido, estadoSincronizacion } = await this.resolverDatosEmpleado(fila, nroDoc);

    //Persistir los datos del empleado y su información financiera de manera atómica
    await this.prisma.$transaction(async (tx) => {
      const empleado = await tx.empleados.upsert({
        where: { nro_documento: nroDoc },
        update: {
          nombre,
          apellido,
          email: sanitizarTexto(fila.email),
          telefono: sanitizarTexto(fila.telefono),
          sexo: fila.sexo,
          estado_civil: fila.estado_civil,
          fecha_nacimiento: fechaNacimiento,
          direccion: sanitizarTexto(fila.direccion),
          departamento: sanitizarTexto(fila.departamento),
          provincia: sanitizarTexto(fila.provincia),
          distrito: sanitizarTexto(fila.distrito),
          ubigeo: sanitizarTexto(fila.ubigeo),
          area_id: area.id,
          cargo_id: cargo.id,
          jornada_id: jornadaId,
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
          email: sanitizarTexto(fila.email),
          telefono: sanitizarTexto(fila.telefono),
          sexo: fila.sexo,
          estado_civil: fila.estado_civil,
          fecha_nacimiento: fechaNacimiento,
          direccion: sanitizarTexto(fila.direccion),
          departamento: sanitizarTexto(fila.departamento),
          provincia: sanitizarTexto(fila.provincia),
          distrito: sanitizarTexto(fila.distrito),
          ubigeo: sanitizarTexto(fila.ubigeo),
          area_id: area.id,
          cargo_id: cargo.id,
          estado_empleado_id: estadoActivo.id,
          jornada_id: jornadaId,
          fecha_inicio: fechaInicio,
          asig_familiar: Boolean(fila.asig_familiar),
          estado_sincronizacion: estadoSincronizacion,
          activo: true
        },
      });

      //Persistir o actualizar los datos financieros del empleado de manera atómica
      await this.upsertDatoFinanciero(tx, empleado.id, fila);
    });
  }

  /**
   * Funcion privada para insertar o actualizar los datos financieros de un empleado.
   * Su principal objetivo es garantizar que la información financiera del empleado 
   * esté sincronizada con los datos proporcionados en la fila de carga masiva.
   * Se realiza una transacción atómica para asegurar la consistencia de los datos.
   * @param tx - La instancia de transacción de Prisma para realizar operaciones atómicas.
   * @param empleadoId - El ID del empleado para el cual se están actualizando o insertando los datos financieros.
   * @param fila - La fila de datos de carga masiva que contiene la información financiera del empleado.
   */
  private async upsertDatoFinanciero(tx: any, empleadoId: string, fila: CargaMasivaFilaDTO): Promise<void> {
    //Resolver Régimen de Pensión y Tipo de AFP
    const regimen = await tx.regimen_pension.findFirst({where: { nombre: { contains: fila.regimen_pension, mode: 'insensitive' } },});

    let tipoAfpId: string | null = null;
    if (fila.regimen_pension === 'AFP' && fila.tipo_afp) {
      const afp = await tx.tipo_afp.findFirst({where: { nombre: { contains: fila.tipo_afp, mode: 'insensitive' } } });
      tipoAfpId = afp?.id ?? null;
    }

    //Resolver bancos de sueldo y CTS de manera concurrente para optimizar el tiempo de respuesta
    const [bancoSueldo, bancoCts] = await Promise.all([
      fila.banco_sueldo ? tx.bancos.findFirst({ where: { nombre: { contains: fila.banco_sueldo, mode: 'insensitive' } } }) : null,
      fila.banco_cts ? tx.bancos.findFirst({ where: { nombre: { contains: fila.banco_cts, mode: 'insensitive' } } }) : null
    ]);

    //Encriptar datos sensibles antes de persistirlos en la base de datos
    const nroCuentaSueldoEnc = fila.nro_cuenta_sueldo ? CryptoUtil.encrypt(fila.nro_cuenta_sueldo.trim()) : null;
    const cciSueldoEnc = fila.cci_sueldo ? CryptoUtil.encrypt(fila.cci_sueldo.trim()) : null;
    const nroCuentaCtsEnc = fila.nro_cuenta_cts ? CryptoUtil.encrypt(fila.nro_cuenta_cts.trim()) : null;
    const cciCtsEnc = fila.cci_cts ? CryptoUtil.encrypt(fila.cci_cts.trim()) : null;

    //Construir el payload de datos financieros a persistir
    const dataPayload = {
      id_regimen: regimen?.id ?? '018f4a7c-4444-7000-d000-000000000001',
      id_tipo_afp: tipoAfpId,
      sueldo_basico: fila.sueldo_basico,
      cuspp: sanitizarTexto(fila.cuspp),
      tipo_comision: sanitizarTexto(fila.tipo_comision),

      id_banco_sueldo: bancoSueldo?.id ?? null,
      tipo_cuenta_sueldo: fila.tipo_cuenta_sueldo,
      nro_cuenta_sueldo: nroCuentaSueldoEnc,
      cci_sueldo: cciSueldoEnc,

      id_banco_cts: bancoCts?.id ?? null,
      tipo_cuenta_cts: fila.tipo_cuenta_cts,
      nro_cuenta_cts: nroCuentaCtsEnc,
      cci_cts: cciCtsEnc,

      regimen_salud: fila.regimen_salud,
      eps_costo_adicional: fila.eps_costo_adicional
    };

    //Persistir o actualizar los datos financieros del empleado de manera atómica usando upsert
    await tx.dato_financiero.upsert({
      where: { empleado_id: empleadoId },
      update: dataPayload,
      create: {
        id: IdentityGenerator.generateId(),
        empleado_id: empleadoId,
        ...dataPayload
      }
    });
  }

  /**
   * Función privada para buscar y validar el tipo de documento en la base de datos.
   * Si el tipo de documento no existe, se lanza un error para detener el procesamiento de la fila.
   * @param tipoDocStr - El tipo de documento en formato string (por ejemplo, 'DNI', 'CE', etc.).
   * @returns - El objeto del tipo de documento encontrado en la base de datos.
   * @throws - Lanza un error si el tipo de documento no existe en la base de datos.
   */
  private async buscarTipoDocumento(tipoDocStr: string) {
    const tipoDoc = await this.prisma.tipo_documento.findFirst({ where: { tipo_documento: { equals: tipoDocStr.trim(), mode: 'insensitive' } } });
    if (!tipoDoc) throw new Error(`El tipo de documento '${tipoDocStr}' no existe en la base de datos.`);
    return tipoDoc;
  }

  /**
   * Funcion privada para resolver el área de un empleado. Si el área no existe, se crea automáticamente.
   * @param areaNombre - El nombre del área a resolver.
   * @returns - El objeto del área resuelto o creado.
   * @throws - Lanza un error si ocurre algún fallo durante la resolución o creación del área.
   */
  private async resolverArea(areaNombre: string) {
    const limpio = areaNombre.trim();
    let area = await this.prisma.area.findFirst({ where: { nombre: { equals: limpio, mode: 'insensitive' }, deleted_at: null },});

    if (!area) 
      area = await this.prisma.area.create({
        data: {
          id: IdentityGenerator.generateId(),
          nombre: limpio,
          descripcion: 'Área creada automáticamente vía Carga Masiva',
          activo: true
        }
      });
    
    return area;
  }

  /**
   * Funcion privada para resolver el cargo de un empleado. Si el cargo no existe, se crea automáticamente.
   * @param areaId - El ID del área a la que pertenece el cargo.
   * @param cargoNombre - El nombre del cargo a resolver.
   * @returns - El objeto del cargo resuelto o creado.
   * @throws - Lanza un error si ocurre algún fallo durante la resolución o creación del cargo.
   * @note - Se asegura que el cargo esté asociado al área correspondiente y que no exista duplicidad de nombres.
   * @note - Si el cargo ya existe, se retorna el objeto existente sin crear uno nuevo.
   */
  private async resolverCargo(areaId: string, cargoNombre: string) {
    const limpio = cargoNombre.trim();
    let cargo = await this.prisma.cargo.findFirst({
      where: { nombre: { equals: limpio, mode: 'insensitive' }, id_area: areaId, deleted_at: null },
    });

    if (!cargo) 
      cargo = await this.prisma.cargo.create({
        data: {
          id: IdentityGenerator.generateId(),
          id_area: areaId,
          nombre: limpio,
          descripcion: 'Cargo creado automáticamente vía Carga Masiva',
          sueldo_minimo: 1130.0,
          activo: true,
        },
      });
    
    return cargo;
  }

  /**
   * Funcion privada para resolver el ID de la jornada laboral de un empleado.
   * @param jornadaNombre - El nombre de la jornada laboral a resolver.
   * @returns - El ID de la jornada laboral resuelto o null si no se encuentra.
   * @throws - Lanza un error si ocurre algún fallo durante la resolución de la jornada laboral.
   * @note - Se busca la jornada laboral en la base de datos ignorando mayúsculas y minúsculas, y considerando solo las jornadas activas (deleted_at = null).
   */
  private async resolverJornadaId(jornadaNombre?: string | null): Promise<string | null> {
    if (!jornadaNombre) return null;
    const jornada = await this.prisma.jornada.findFirst({
      where: { nombre: { equals: jornadaNombre.trim(), mode: 'insensitive' }, deleted_at: null },
      select: { id: true },
    });
    return jornada?.id ?? null;
  }

  /**
   * Funcion privada para resolver los datos del empleado, incluyendo nombre, apellido y estado de sincronización.
   * Si el nombre o apellido no están presentes y el tipo de documento es DNI, se consulta la API de RENIEC para obtener los datos.
   * Si la consulta falla o los datos no están disponibles, se asignan valores por defecto y se marca el estado de sincronización como "BORRADOR".
   * @param fila - Objeto que contiene los datos de la fila de empleado a procesar.
   * @param nroDoc - El número de documento del empleado, utilizado para la consulta a RENIEC si es necesario.
   * @returns - Un objeto que contiene el nombre, apellido y estado de sincronización del empleado.
   * @throws - Lanza un error si ocurre algún fallo durante la consulta a RENIEC o el procesamiento de los datos.
   * @note - Se asegura que el nombre y apellido siempre tengan un valor, ya sea obtenido de RENIEC o asignado por defecto.
   */
  private async resolverDatosEmpleado(fila: CargaMasivaFilaDTO, nroDoc: string) {
    let nombre = fila.nombre || null;
    let apellido = fila.apellido || null;
    let estadoSincronizacion: 'COMPLETO' | 'BORRADOR' = 'COMPLETO';

    if ((!nombre || !apellido) && fila.tipo_documento === 'DNI') {
      try {
        const ciudadano = await this.reniecAdapter.consultarDni(nroDoc);
        nombre = ciudadano.nombre;
        apellido = `${ciudadano.apellido_paterno} ${ciudadano.apellido_materno}`.trim();
      } catch {
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