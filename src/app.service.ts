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
          { name: 'Daniel Singer', role: 'Desarrollador Principal y Líder de Equipo', comment: 'Líder del equipo de desarrollo & encargado del backend' },
          { name: 'Rodrigo del Castillo', role: 'Desarrollador Frontend', comment: 'Se encargo de la implementación del frontend y la experiencia del usuario' },
          { name: 'Adrian Matias Dueñas', role: 'Desarrollador Backend', comment: 'Se encargo de la implementación del backend y las integraciones' },
          { name: 'Dylan Yessid Florez', role: 'Scrum Master and Developer', comment: 'Documentacion & Backend' },
          { name: 'Julio Vargas', role: 'Desarrollador Junior', comment: 'Ayudante de Frontend, colaboración en la implementación de funcionalidades y pruebas' },
          { name: 'Luis Sipion', role: 'Desarrollador Junior', comment: 'Ayudante de Frontend, colavoración en la implementación de funcionalidades y pruebas' },
        ]
      }
    };
  }
}