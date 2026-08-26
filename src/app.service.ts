import { Injectable } from '@nestjs/common';

export interface SystemHealthInfo {
  status: string;
  system: string;
  version: string;
  environment: string;
  timestamp: string;
  credits: {
    organization: string;
    project: string;
    makers: {
      name: string;
      role: string;
      comment?: string;
    }[];
  };
}

/**
 * Servicio raíz encargado de entregar metadatos del estado del sistema,
 * créditos de la plataforma y comprobación de disponibilidad (Health Check).
 */
@Injectable()
export class AppService {
  getHealth(): SystemHealthInfo {
    return {
      status: 'online',
      system: 'Bella Planillas API - Backend RRHH & Nómina',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      credits: {
        organization: 'J&P Perifericos S.A.C',
        project: 'Bella Planillas Enterprise System',
        makers: [
          { name: 'Daniel Singer', role: 'Desarrollador', comment: 'Líder del equipo de desarrollo' },
          { name: 'Rodrigo del Castillo', role: 'Desarrollador', comment: 'Frontend & UI/UX' },
          { name: 'Adrian Matias Dueñas', role: 'Desarrollador', comment: 'Backend & Integraciones' },
          { name: 'Dylan Yessid Florez', role: 'Desarrollador', comment: 'Documentacion' },
        ]
      }
    };
  }
}