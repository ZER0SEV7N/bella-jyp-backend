//src/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { sanitizarTexto } from '@/common/utils/transformacion.util';
import { Prisma } from '@prisma/client';
import { normalizarFecha } from './helpers/normalizaciones.helper';

/**
 * Caso de uso para procesar una fila de datos de empleado en la carga masiva.
 * Este caso de uso se encarga de validar, transformar y persistir los datos de un empleado
 * en la base de datos, asegurando la integridad y consistencia de la información.
 */
@Injectable()
export class ProcesarFilaEmpleadoUseCase {
  constructor(private readonly prisma: PrismaService) {}

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
    //También protege los trabajos antiguos que quedaron en cola antes del contrato obligatorio.
    if (!fila.nombre?.trim() || !fila.apellido?.trim())
      throw new Error(`La fila del trabajo ${jobId} requiere nombre y apellido completos.`);
    const nombre = fila.nombre.trim();
    const apellido = fila.apellido.trim();
    const estadoSincronizacion = 'COMPLETO' as const;

    //Transformar y normalizar los datos de la fila antes de persistirlos
    const tipoDoc = await this.buscarTipoDocumento(fila.tipo_documento);
    const area = await this.resolverArea(fila.area);
    const cargo = await this.resolverCargo(area.id, fila.cargo);
    const jornadaId = await this.resolverJornadaId(fila.jornada);

    //Normalizar las fechas previamente validadas por el contrato de carga
    const fechaNacimiento = normalizarFecha(fila.fecha_nacimiento);
    const fechaInicio = normalizarFecha(fila.fecha_inicio);
    if (!fechaInicio || !fechaNacimiento) throw new Error('Las fechas de nacimiento e ingreso son obligatorias.');

    //Persistir los datos del empleado y su información financiera de manera atómica
    await this.prisma.$transaction(async (tx) => {
      const empleado = await tx.empleados.upsert({
        where: { nro_documento: nroDoc },
        update: {
          nombre,
          apellido,
          email: fila.email.trim(),
          telefono: fila.telefono.trim(),
          sexo: fila.sexo,
          estado_civil: fila.estado_civil,
          fecha_nacimiento: fechaNacimiento,
          direccion: fila.direccion.trim(),
          referencia_direccion: fila.referencia_direccion.trim(),
          nacionalidad: fila.nacionalidad,
          afp_fecha_filiacion: normalizarFecha(fila.afp_fecha_filiacion),
          departamento: fila.departamento.trim(),
          provincia: fila.provincia.trim(),
          distrito: fila.distrito.trim(),
          ubigeo: fila.ubigeo.trim(),
          area_id: area.id,
          cargo_id: cargo.id,
          jornada_id: jornadaId,
          fecha_inicio: fechaInicio,
          asig_familiar: Boolean(fila.asig_familiar),
          estado_sincronizacion: estadoSincronizacion,
          activo: true,
        },
        create: {
          id: IdentityGenerator.generateId(),
          documento_id: tipoDoc.id,
          nro_documento: nroDoc,
          nombre,
          apellido,
          email: fila.email.trim(),
          telefono: fila.telefono.trim(),
          sexo: fila.sexo,
          estado_civil: fila.estado_civil,
          fecha_nacimiento: fechaNacimiento,
          direccion: fila.direccion.trim(),
          referencia_direccion: fila.referencia_direccion.trim(),
          nacionalidad: fila.nacionalidad,
          afp_fecha_filiacion: normalizarFecha(fila.afp_fecha_filiacion),
          departamento: fila.departamento.trim(),
          provincia: fila.provincia.trim(),
          distrito: fila.distrito.trim(),
          ubigeo: fila.ubigeo.trim(),
          area_id: area.id,
          cargo_id: cargo.id,
          estado_laboral: 'ACTIVO',
          jornada_id: jornadaId,
          fecha_inicio: fechaInicio,
          asig_familiar: Boolean(fila.asig_familiar),
          estado_sincronizacion: estadoSincronizacion,
          activo: true,
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
  private async upsertDatoFinanciero(tx: Prisma.TransactionClient, empleadoId: string, fila: CargaMasivaFilaDTO): Promise<void> {
    //Resolver Régimen de Pensión y Tipo de AFP
    const regimen = await tx.regimen_pension.findFirst({
      where: { nombre: { in: fila.regimen_pension === 'AFP' ? ['AFP', 'SPP'] : ['ONP'], mode: 'insensitive' } },
    });

    if (!regimen) throw new Error(`El régimen '${fila.regimen_pension}' no existe en el catálogo.`);

    let tipoAfpId: string | null = null;
    if (fila.regimen_pension === 'AFP' && fila.tipo_afp) {
      const afp = await tx.tipo_afp.findFirst({ where: { nombre: { contains: fila.tipo_afp, mode: 'insensitive' } } });
      if (!afp) throw new Error('La AFP indicada no existe.');
      tipoAfpId = afp.id;
    }

    //Resolver bancos de sueldo y CTS de manera concurrente para optimizar el tiempo de respuesta
    const [bancoSueldo, bancoCts] = await Promise.all([
      fila.banco_sueldo ? tx.bancos.findFirst({ where: { nombre: { contains: fila.banco_sueldo, mode: 'insensitive' } } }) : null,
      fila.banco_cts ? tx.bancos.findFirst({ where: { nombre: { contains: fila.banco_cts, mode: 'insensitive' } } }) : null,
    ]);

    if (fila.banco_sueldo && !bancoSueldo) throw new Error('El banco de sueldo indicado no existe.');
    if (fila.banco_cts && !bancoCts) throw new Error('El banco CTS indicado no existe.');

    //Encriptar datos sensibles antes de persistirlos en la base de datos
    const nroCuentaSueldoEnc = CryptoUtil.encryptOptional(fila.nro_cuenta_sueldo);
    const cciSueldoEnc = CryptoUtil.encryptOptional(fila.cci_sueldo);
    const nroCuentaCtsEnc = CryptoUtil.encryptOptional(fila.nro_cuenta_cts);
    const cciCtsEnc = CryptoUtil.encryptOptional(fila.cci_cts);

    //Construir el payload de datos financieros a persistir
    const dataPayload = {
      id_regimen: regimen.id,
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
      eps_costo_adicional: fila.eps_costo_adicional,
    };

    //Persistir o actualizar los datos financieros del empleado de manera atómica usando upsert
    await tx.dato_financiero.upsert({
      where: { empleado_id: empleadoId },
      update: dataPayload,
      create: {
        id: IdentityGenerator.generateId(),
        empleado_id: empleadoId,
        ...dataPayload,
      },
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
    const tipoDoc = await this.prisma.tipo_documento.findFirst({
      where: { tipo_documento: { equals: tipoDocStr.trim(), mode: 'insensitive' } },
    });
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
    let area = await this.prisma.area.findFirst({ where: { nombre: { equals: limpio, mode: 'insensitive' }, deleted_at: null } });

    if (!area)
      area = await this.prisma.area.create({
        data: {
          id: IdentityGenerator.generateId(),
          nombre: limpio,
          descripcion: 'Área creada automáticamente vía Carga Masiva',
          activo: true,
        },
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
}
