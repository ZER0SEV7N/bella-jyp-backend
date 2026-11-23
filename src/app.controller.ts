import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import type { SystemHealthInfo } from './app.service';
import { ApiTags } from '@nestjs/swagger';
import { ApiOperacionDocumentada } from '@/common/decorators/api-contrato.decorator';

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
  @ApiOperacionDocumentada({
    summary: 'Estado del sistema, health check y metadata del backend',
    description:
      'Endpoint público de verificación de disponibilidad que devuelve estado, nombre del sistema, versión, entorno, timestamp y créditos del proyecto.',
    roles: [],
    respuesta: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'online' },
        system: { type: 'string' },
        version: { type: 'string' },
        environment: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        credits: {
          type: 'object',
          properties: {
            organization: { type: 'string' },
            project: { type: 'string' },
            makers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  role: { type: 'string' },
                  comment: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  getHealth(): SystemHealthInfo {
    return this.appService.getHealth();
  }
}
