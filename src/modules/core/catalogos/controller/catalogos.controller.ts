//src/modules/core/catalogos/controller/catalogos.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ObtenerCatalogosUseCase } from '../use-cases/obtenerCatalogos.useCase';
import {
  ApiSwaggerCatalogosController,
  ApiSwaggerListarModalidadesContrato,
  ApiSwaggerListarRegimenesPension,
  ApiSwaggerListarTiposDocumento,
} from '../decorators/catalogos-swagger.decorator';

/**
 * Controlador de catálogos base del core.
 * Expone los catálogos que el frontend consume en formularios (tipos de documento,
 * regímenes pensionarios y modalidades de contrato) para no hardcodearlos.
 */
@ApiSwaggerCatalogosController()
@Controller('api/v1/core/catalogos')
@UseGuards(JwtAccessGuard, RolesGuard)
export class CatalogosController {
  constructor(private readonly obtenerCatalogos: ObtenerCatalogosUseCase) {}

  /** `GET /api/v1/core/catalogos/tipos-documento` */
  @Get('tipos-documento')
  @Roles('ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE')
  @ApiSwaggerListarTiposDocumento()
  listarTiposDocumento() {
    return this.obtenerCatalogos.listarTiposDocumento();
  }

  /** `GET /api/v1/core/catalogos/regimenes-pensionarios` */
  @Get('regimenes-pensionarios')
  @Roles('ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE')
  @ApiSwaggerListarRegimenesPension()
  listarRegimenesPension() {
    return this.obtenerCatalogos.listarRegimenesPension();
  }

  /** `GET /api/v1/core/catalogos/modalidades-contrato` */
  @Get('modalidades-contrato')
  @Roles('ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE')
  @ApiSwaggerListarModalidadesContrato()
  listarModalidadesContrato() {
    return this.obtenerCatalogos.listarModalidadesContrato();
  }
}
