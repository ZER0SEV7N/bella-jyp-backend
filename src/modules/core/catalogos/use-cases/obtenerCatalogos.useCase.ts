//src/modules/core/catalogos/use-cases/obtenerCatalogos.useCase.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Modalidades legales de contrato a plazo fijo (D.S. 003-97-TR).
 * `contrato.tipo_modalidad` es una cadena libre en BD, por eso los valores válidos se centralizan
 * aquí para que el frontend deje de hardcodearlos y consuma este catálogo.
 */
export const MODALIDADES_CONTRATO = [
  { codigo: 'INDEFINIDO', descripcion: 'Indefinido' },
  { codigo: 'PLAZO_FIJO', descripcion: 'Plazo fijo' },
  { codigo: 'NECESIDAD_DEL_MERCADO', descripcion: 'Necesidad del mercado' },
  { codigo: 'INICIO_DE_ACTIVIDAD', descripcion: 'Inicio de actividad' },
  {
    codigo: 'OBRA_DETERMINADA',
    descripcion: 'Obra determinada o servicio específico',
  },
  { codigo: 'OCASIONAL', descripcion: 'Ocasional' },
  { codigo: 'SUPLENCIA', descripcion: 'Suplencia' },
] as const;

/**
 * Caso de uso para exponer los catálogos base que el frontend hoy hardcodea (COM-M1).
 * Solo lectura; sin escritura ni reglas de negocio.
 */
@Injectable()
export class ObtenerCatalogosUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /** Tipos de documento de identidad (DNI, CE, PASAPORTE…). */
  async listarTiposDocumento() {
    return this.prisma.tipo_documento.findMany({
      orderBy: { tipo_documento: 'asc' },
      select: { id: true, tipo_documento: true },
    });
  }

  /** Regímenes pensionarios (ONP, SPP/AFP). */
  async listarRegimenesPension() {
    return this.prisma.regimen_pension.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    });
  }

  /** Modalidades legales de contrato (catálogo estático). */
  async listarModalidadesContrato() {
    return MODALIDADES_CONTRATO;
  }
}
