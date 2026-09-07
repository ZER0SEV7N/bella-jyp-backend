import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import type { SystemHealthInfo } from './app.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Core System')
@Controller('/api/v1/health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Endpoint de comprobación de salud y metadata básica del backend.
   * GET /api/v1/health
   * @returns Un objeto con información sobre el estado del sistema, versión, entorno y créditos del proyecto.
   * @throws InternalServerErrorException - Si ocurre un error inesperado al obtener la información de salud.
   */
  @Get()
  @ApiOperation({ summary: 'Estado del Sistema, Health Check y Metadata Backend' })
  getHealth(): SystemHealthInfo {
    return this.appService.getHealth();
  }
}