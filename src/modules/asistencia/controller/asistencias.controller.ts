import { Controller, Post, HttpCode, HttpStatus, UsePipes, Body, Res } from '@nestjs/common';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { marcarAsistenciaSchema } from '@jyp/shared-contracts';
import type { MarcarAsistenciaDto } from '@jyp/shared-contracts';
import { CrearMarcacionManualUseCase } from '../use-cases/marcacion/crearMarcacionManual.useCase';
import { generarReporteSemanalUseCase } from '../use-cases/marcacion/generarReporteSemana.useCase';
import type { FastifyReply } from 'fastify';
@Controller('api/asistencia/marcacion')
export class AsistenciaController{
    constructor(
        private readonly crearMarcacionManualUseCase: CrearMarcacionManualUseCase,
        private readonly crearReporteSemanalUseCase: generarReporteSemanalUseCase,
    ) {}
    @Post('generar-manual')
    @HttpCode(HttpStatus.OK)
    @UsePipes(new ZodValidationPipe( marcarAsistenciaSchema))
    async generarCierre(@Body() dto: MarcarAsistenciaDto) {
        return await this.crearMarcacionManualUseCase.execute(dto);
    }

    @Post('reporte/asistencia-semanal')
    async descargarReporteAsistencia(
        @Body() dto: any, @Res() res: FastifyReply,
    ) {   
        const buffer = await this.crearReporteSemanalUseCase.execute(dto);

    res.header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.header(
      'content-disposition',
      'attachment; filename="reporte_asistencia_semanal.xlsx"',
    );

    res.send(buffer);
    }

}