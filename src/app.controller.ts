import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import type { SystemHealthInfo } from './app.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Core System')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Endpoint de comprobación de salud y metadata básica del backend.
   * GET /
   */
  @Get()
  @ApiOperation({ summary: 'Estado del Sistema, Health Check y Metadata Backend' })
  getHealth(): SystemHealthInfo {
    return this.appService.getHealth();
  }
}